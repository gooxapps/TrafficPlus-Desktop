const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require('http');
const https = require('https');
const { URL } = require('url');
const { chromium, devices } = require("playwright");
const { initDatabase, getDb } = require('./db');
// Auto-updater (GitHub Releases)
let autoUpdater;
try {
  const updater = require('electron-updater');
  autoUpdater = updater.autoUpdater;
  const log = require('electron-log');
  autoUpdater.logger = log;
  autoUpdater.logger.transports.file.level = 'info';
  autoUpdater.autoDownload = true;
  // Install update automatically on quit
  autoUpdater.autoInstallOnAppQuit = true;
} catch (e) {
  console.warn('electron-updater not available in this environment:', e && e.message);
}

// Guard console.error so broken pipes in the Electron dev environment do not crash the main process
const originalConsoleError = console.error.bind(console);
console.error = (...args) => {
  try {
    originalConsoleError(...args);
  } catch (e) {
    try {
      if (process && process.stderr && typeof process.stderr.write === 'function') {
        process.stderr.write(`console.error failed: ${e?.message || e}\n`);
      }
    } catch (_) {
      // ignore
    }
  }
};

// Track active Playwright browsers/pages
// value: { browser, page, context, url, headless, proxyId, accountName }
const activeBrowsers = new Map();

// Proxy rotation manager for multi-account campaigns
const proxyRotationManager = {
  accountProxies: new Map(), // accountName -> proxy
  proxyUsage: new Map(),      // proxyId -> { lastUsedTime, slotIds }
  accountRotationIndex: 0,    // Round-robin counter for accounts
  
  registerAccount(accountName, proxy) {
    this.accountProxies.set(accountName, proxy);
  },
  
  getNextProxy(allProxies, accountNames) {
    if (allProxies.length === 0) return null;
    
    // Find least recently used proxy
    let lruProxy = allProxies[0];
    let oldestTime = Infinity;
    
    for (const proxy of allProxies) {
      const usage = this.proxyUsage.get(proxy.id) || { lastUsedTime: 0, slotIds: [] };
      if (usage.lastUsedTime < oldestTime) {
        oldestTime = usage.lastUsedTime;
        lruProxy = proxy;
      }
    }
    
    // Update usage
    const usage = this.proxyUsage.get(lruProxy.id) || { lastUsedTime: 0, slotIds: [] };
    usage.lastUsedTime = Date.now();
    this.proxyUsage.set(lruProxy.id, usage);
    
    return lruProxy;
  },
  
  trackSlotProxy(slotId, proxyId) {
    const usage = this.proxyUsage.get(proxyId) || { lastUsedTime: 0, slotIds: [] };
    if (!usage.slotIds.includes(slotId)) {
      usage.slotIds.push(slotId);
    }
    this.proxyUsage.set(proxyId, usage);
  },
  
  releaseSlotProxy(slotId) {
    for (const [proxyId, usage] of this.proxyUsage.entries()) {
      const idx = usage.slotIds.indexOf(slotId);
      if (idx !== -1) {
        usage.slotIds.splice(idx, 1);
      }
    }
  },
  
  getStats() {
    const stats = {};
    for (const [proxyId, usage] of this.proxyUsage.entries()) {
      stats[proxyId] = {
        usedCount: usage.slotIds.length,
        lastUsedTime: new Date(usage.lastUsedTime).toISOString()
      };
    }
    return stats;
  }
};

// 2Captcha API integration for solving image/reCAPTCHA captchas
// Requires API key stored in app settings
const captchaSolver = {
  API_KEY: null, // Set from settings
  BASE_URL: 'http://2captcha.com',
  
  setApiKey(key) {
    this.API_KEY = key;
  },
  
  // Send image captcha to 2Captcha
  async solveImageCaptcha(imageBase64, options = {}) {
    if (!this.API_KEY) {
      console.warn('[2Captcha] No API key configured');
      return null;
    }
    
    try {
      const params = new URLSearchParams({
        apikey: this.API_KEY,
        method: 'base64',
        base64: imageBase64,
        json: 1,
        ...options // Additional options like captchafile, numeric, etc.
      });
      
      const response = await this.makeRequest(`${this.BASE_URL}/in.php?${params}`);
      if (response.status === 0) {
        console.error('[2Captcha] Error:', response.error_text);
        return null;
      }
      
      const captchaId = response.captcha;
      console.log(`[2Captcha] Captcha submitted, ID: ${captchaId}`);
      
      // Poll for result
      return await this.getResult(captchaId);
    } catch (e) {
      console.error('[2Captcha] Image captcha error:', e.message);
      return null;
    }
  },
  
  // Send reCAPTCHA V2/V3 to 2Captcha
  async solveRecaptcha(siteKey, pageUrl, recaptchaType = 'v2', options = {}) {
    if (!this.API_KEY) {
      console.warn('[2Captcha] No API key configured');
      return null;
    }
    
    try {
      const method = recaptchaType === 'v3' ? 'userrecaptcha' : 'userrecaptcha';
      const params = new URLSearchParams({
        apikey: this.API_KEY,
        method: method,
        googlekey: siteKey,
        pageurl: pageUrl,
        json: 1,
        version: recaptchaType === 'v3' ? 'v3' : 'v2',
        ...options
      });
      
      const response = await this.makeRequest(`${this.BASE_URL}/in.php?${params}`);
      if (response.status === 0) {
        console.error('[2Captcha] Error:', response.error_text);
        return null;
      }
      
      const captchaId = response.captcha;
      console.log(`[2Captcha] reCAPTCHA submitted, ID: ${captchaId}`);
      
      // Poll for result
      return await this.getResult(captchaId);
    } catch (e) {
      console.error('[2Captcha] reCAPTCHA error:', e.message);
      return null;
    }
  },
  
  // Poll 2Captcha for result
  async getResult(captchaId, maxAttempts = 30, delayMs = 2000) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        await new Promise(r => setTimeout(r, delayMs));
        
        const params = new URLSearchParams({
          apikey: this.API_KEY,
          action: 'get',
          captcha_id: captchaId,
          json: 1
        });
        
        const response = await this.makeRequest(`${this.BASE_URL}/res.php?${params}`);
        
        if (response.status === 0) {
          if (response.request === 'CAPCHA_NOT_READY') {
            console.log(`[2Captcha] Still processing... (${attempt + 1}/${maxAttempts})`);
            continue;
          }
          console.error('[2Captcha] Error:', response.error_text);
          return null;
        }
        
        const result = response.request;
        console.log(`[2Captcha] Solution received: ${result.substring(0, 20)}...`);
        return result;
      } catch (e) {
        console.error('[2Captcha] Poll error:', e.message);
        continue;
      }
    }
    
    console.error('[2Captcha] Timeout waiting for solution');
    return null;
  },
  
  // Helper to make HTTP requests to 2Captcha
  async makeRequest(url) {
    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });
  },
  
  // Helper: Extract image captcha from page and solve it
  async solveCaptchaOnPage(page, imageSelectorOrElement) {
    try {
      let imageBase64;
      if (typeof imageSelectorOrElement === 'string') {
        imageBase64 = await page.locator(imageSelectorOrElement).screenshot({ encoding: 'base64' });
      } else {
        imageBase64 = await imageSelectorOrElement.screenshot({ encoding: 'base64' });
      }
      
      const solution = await this.solveImageCaptcha(imageBase64);
      return solution;
    } catch (e) {
      console.error('[2Captcha] Failed to extract and solve captcha:', e.message);
      return null;
    }
  }
};

// Simple concurrency limit for Playwright browser slots to reduce CPU/memory usage
const MAX_CONCURRENT_BROWSERS = parseInt(process.env.MAX_CONCURRENT_BROWSERS, 10) || 4;

// Helper to wait for an available browser slot (polling). Resolves when slot available or rejects on timeout.
const waitForBrowserSlot = (timeoutMs = 30000) => {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const iv = setInterval(() => {
      if (activeBrowsers.size < MAX_CONCURRENT_BROWSERS) {
        clearInterval(iv);
        resolve();
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(iv);
        reject(new Error('Timeout waiting for browser slot'));
      }
    }, 200);
  });
};

// Helper to close a single browser with timeout and cleanup
const closeBrowserWithTimeout = async (slotId, browser, context, timeout = 5000) => {
  try {
    await saveCookies(slotId, context);
  } catch (e) {
    console.error(`Failed to save cookies for slot ${slotId}:`, e);
  }

  let closed = false;
  try {
    const p = browser.close();
    const t = new Promise((resolve) => setTimeout(resolve, timeout));
    await Promise.race([p.then(() => { closed = true; }), t]);
    if (!closed) {
      try {
        // Best-effort cross-platform kill (SIGKILL is Unix-only; process.kill(pid)
        // with no signal defaults to SIGTERM on Unix and TerminateProcess on Windows)
        const pid = browser._process && browser._process.pid;
        if (pid) process.kill(pid);
      } catch (e) {
        // ignore — process may have already exited
      }
    }
  } catch (e) {
    console.error(`Error while closing browser for slot ${slotId}:`, e);
  } finally {
    try { activeBrowsers.delete(slotId); } catch (e) { /* ignore */ }
  }
};

// Close all active browsers (graceful with timeout)
const closeAllBrowsers = async (perBrowserTimeout = 5000) => {
  const tasks = [];
  for (const [slotId, entry] of activeBrowsers.entries()) {
    tasks.push(closeBrowserWithTimeout(slotId, entry.browser, entry.context, perBrowserTimeout));
  }
  await Promise.all(tasks);
};

// Helper to send update events to all renderer windows
function sendUpdateEvent(type, payload) {
  try {
    for (const w of BrowserWindow.getAllWindows()) {
      try { w.webContents.send('update:event', type, payload); } catch (e) { /* ignore */ }
    }
  } catch (e) {
    console.error('Failed to broadcast update event:', e);
  }
}

if (autoUpdater) {
  autoUpdater.on('checking-for-update', () => sendUpdateEvent('checking'));
  autoUpdater.on('update-available', (info) => sendUpdateEvent('available', info));
  autoUpdater.on('update-not-available', (info) => sendUpdateEvent('not-available', info));
  autoUpdater.on('download-progress', (progress) => sendUpdateEvent('progress', progress));
  autoUpdater.on('update-downloaded', (info) => {
    sendUpdateEvent('downloaded', info);
    // Do NOT auto-restart here — let the user click "Restart & Install" in the
    // UpdateBanner. autoInstallOnAppQuit=true means it installs when they close naturally.
    console.log('[updater] Update downloaded, waiting for user to restart:', info.version);
  });
}

// Device presets
const DEVICE_PRESETS = {
  'Desktop Chrome': {
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    hasTouch: false,
    isMobile: false,
  },
  'Desktop Chrome (macOS)': {
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    hasTouch: false,
    isMobile: false,
  },
  'Desktop Firefox': {
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
    hasTouch: false,
    isMobile: false,
  },
  'Desktop Firefox (macOS)': {
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:132.0) Gecko/20100101 Firefox/132.0',
    hasTouch: false,
    isMobile: false,
  },
  'Desktop Safari': {
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
    hasTouch: false,
    isMobile: false,
  },
  'Desktop Edge': {
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
    hasTouch: false,
    isMobile: false,
  },
  'iPhone 14 Pro Max': devices['iPhone 14 Pro Max'],
  'iPhone 14 Pro': devices['iPhone 14 Pro'],
  'iPhone 15 Pro Max': devices['iPhone 15 Pro Max'],
  'Samsung Galaxy S24': devices['Galaxy S24 Ultra'],
  'Samsung Galaxy S23': devices['Galaxy S23 Ultra'],
  'iPad Pro': devices['iPad Pro 12.9'],
};

// User behavior profiles - different types of "users" with distinct patterns
const USER_PROFILES = {
  'Speedy Reader': {
    name: 'Speedy Reader',
    typingSpeed: 0.6, // Faster typing
    scrollSpeed: 0.7, // Faster scrolling
    clickFrequency: 0.9, // More likely to click
    pauseMultiplier: 0.5, // Shorter pauses
    jitterFrequency: 0.7, // More jitter
    viewportScanChance: 0.3,
    textSelectChance: 0.15,
    keyboardNavChance: 0.2
  },
  'Careful Browser': {
    name: 'Careful Browser',
    typingSpeed: 1.2, // Slower typing
    scrollSpeed: 1.3, // Slower scrolling
    clickFrequency: 0.7, // Less likely to click
    pauseMultiplier: 1.5, // Longer pauses
    jitterFrequency: 0.5, // Less jitter
    viewportScanChance: 0.6,
    textSelectChance: 0.4,
    keyboardNavChance: 0.4
  },
  'Average Joe': {
    name: 'Average Joe',
    typingSpeed: 1.0,
    scrollSpeed: 1.0,
    clickFrequency: 1.0,
    pauseMultiplier: 1.0,
    jitterFrequency: 1.0,
    viewportScanChance: 0.4,
    textSelectChance: 0.25,
    keyboardNavChance: 0.3
  },
  'Mobile User': {
    name: 'Mobile User',
    typingSpeed: 1.4, // Slower (typing on phone)
    scrollSpeed: 0.8, // Flick scrolling
    clickFrequency: 0.8,
    pauseMultiplier: 1.2,
    jitterFrequency: 1.3, // More jitter (touch screen)
    viewportScanChance: 0.2,
    textSelectChance: 0.1,
    keyboardNavChance: 0.1 // Less keyboard on mobile
  }
};

// Helper to get random user profile
function getRandomUserProfile() {
  const profileKeys = Object.keys(USER_PROFILES);
  const randomKey = profileKeys[Math.floor(Math.random() * profileKeys.length)];
  return USER_PROFILES[randomKey];
}

// Time-based behavior patterns
function getTimeBasedMultiplier() {
  const now = new Date();
  const hour = now.getHours();
  const dayOfWeek = now.getDay();
  
  let multiplier = 1.0;
  
  // Work hours (9-5 Mon-Fri) - more focused browsing
  if (hour >= 9 && hour <= 17 && dayOfWeek >= 1 && dayOfWeek <= 5) {
    multiplier = 0.8; // Faster, more purposeful
  } 
  // Evening (5-10 PM) - more relaxed browsing
  else if (hour >= 17 && hour <= 22) {
    multiplier = 1.2; // Slower, more exploration
  }
  // Night (10 PM - 6 AM) - very relaxed
  else if (hour >= 22 || hour <= 6) {
    multiplier = 1.4; // Even slower
  }
  
  // Weekend multiplier
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    multiplier *= 1.1;
  }
  
  return multiplier;
}

// Search engine presets
const SEARCH_ENGINES = {
  'Google': {
    url: 'https://www.google.com',
    searchInputSelector: 'textarea[name="q"]',
    submitSelector: 'input[name="btnK"]',
  },
  'StaySafeSearch': {
    url: 'https://www.staysafesearch.com',
    searchInputSelector: 'input[name="q"]',
    submitSelector: 'button[type="submit"]',
  },
  'DuckDuckGo': {
    url: 'https://duckduckgo.com',
    searchInputSelector: 'input[name="q"]',
    submitSelector: 'button[type="submit"]',
  },
};

const FREELANCE_PLATFORMS = {
  Fiverr: {
    domain: 'fiverr.com',
    queryPrefix: 'site:fiverr.com',
  },
  Upwork: {
    domain: 'upwork.com',
    queryPrefix: 'site:upwork.com',
  },
  Kwork: {
    domain: 'kwork.com',
    queryPrefix: 'site:kwork.com',
  },
};

async function performFreelancingSearchMode(page, targetUrl, searchEngine, keywords, platform, targetName, pageNumber = 1, sort = 'Relevance') {
  const engine = SEARCH_ENGINES[searchEngine] || SEARCH_ENGINES['Google'];
  const platformConfig = FREELANCE_PLATFORMS[platform] || FREELANCE_PLATFORMS.Fiverr;
  const searchText = `${platformConfig.queryPrefix} ${keywords || ''} ${targetName || ''}`.trim();
  const exactName = (targetName || '').trim().toLowerCase();
  const platformDomain = platformConfig.domain.toLowerCase();

  // Navigate to the search engine and enter the freelancing query
  await page.goto(engine.url, { waitUntil: 'networkidle', timeout: 30000 });
  await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 1000));
  await page.waitForSelector(engine.searchInputSelector, { timeout: 10000 });
  await hoverBeforeClick(page, engine.searchInputSelector);
  const searchInput = await page.$(engine.searchInputSelector);
  if (!searchInput) throw new Error('Search input not found for freelancing mode');
  await typeWithHumanLikeBehavior(page, searchInput, searchText);
  await searchInput.press('Enter');
  await page.waitForLoadState('networkidle', { timeout: 30000 });
  await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 1500));

  // If a results page number was requested, try to switch to it.
  if (pageNumber > 1) {
    try {
      const pageNav = await page.$(`a[href*='start=${(pageNumber - 1) * 10}']`);
      if (pageNav) {
        await hoverBeforeClick(page, `a[href*='start=${(pageNumber - 1) * 10}']`);
        await page.waitForLoadState('networkidle', { timeout: 30000 });
      }
    } catch (e) {
      // ignore if page navigation is not available for this engine
    }
  }

  await scrollWithBacktracking(page);

  const normalizedTarget = targetUrl ? targetUrl.toLowerCase() : '';
  const candidates = await page.$$eval('a[href]', anchors => anchors.map(a => ({ href: a.href, text: a.innerText || '', title: a.title || '' })));
  let chosenHref = null;

  for (const item of candidates) {
    const href = item.href.toLowerCase();
    const text = `${item.text} ${item.title}`.toLowerCase();
    const hasPlatform = href.includes(platformDomain);
    const hasExactName = exactName && text.includes(exactName);
    const hasTargetUrl = normalizedTarget && href.includes(normalizedTarget);

    if (hasPlatform && hasExactName) {
      chosenHref = item.href;
      break;
    }
    if (!chosenHref && hasPlatform && normalizedTarget && hasTargetUrl) {
      chosenHref = item.href;
    }
    if (!chosenHref && hasPlatform && text.includes(keywords.toLowerCase())) {
      chosenHref = item.href;
    }
  }

  if (chosenHref) {
    await page.goto(chosenHref, { waitUntil: 'networkidle', timeout: 30000 });
    await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 1200));
    await scrollWithBacktracking(page);
    return true;
  }

  console.log(`[Freelancing] No matching link found; falling back to direct navigation: ${targetUrl}`);
  await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 });
  await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 1200));
  return true;
}

// Network throttling presets (inspired by Chrome DevTools)
const NETWORK_PRESETS = {
  'none': undefined, // No throttling
  'slow-2g': { download: 500 * 1000 / 8, upload: 500 * 1000 / 8, latency: 400 },
  '2g': { download: 1400 * 1000 / 8, upload: 600 * 1000 / 8, latency: 300 },
  'slow-3g': { download: 2000 * 1000 / 8, upload: 1000 * 1000 / 8, latency: 200 },
  '3g': { download: 3500 * 1000 / 8, upload: 1500 * 1000 / 8, latency: 100 },
  '4g': { download: 16000 * 1000 / 8, upload: 8000 * 1000 / 8, latency: 50 },
  '5g': { download: 100000 * 1000 / 8, upload: 50000 * 1000 / 8, latency: 10 },
  'slow-wifi': { download: 10000 * 1000 / 8, upload: 5000 * 1000 / 8, latency: 40 },
};

// Cookie persistence helpers
const getCookieStoragePath = () => {
  // When packaged, __dirname is inside the read-only ASAR archive.
  // Use app.getPath('userData') so cookies are written to a writable location.
  const baseDir = app.isPackaged
    ? app.getPath('userData')
    : path.join(__dirname, '..', 'data');
  const cookieDir = path.join(baseDir, 'cookies');
  try {
    if (fs.existsSync(cookieDir)) {
      const stat = fs.statSync(cookieDir);
      if (!stat.isDirectory()) {
        // If a file exists where the dir should be, remove it and create dir
        fs.unlinkSync(cookieDir);
        fs.mkdirSync(cookieDir, { recursive: true });
      }
    } else {
      fs.mkdirSync(cookieDir, { recursive: true });
    }
  } catch (e) {
    try { fs.mkdirSync(cookieDir, { recursive: true }); } catch (e2) { /* ignore */ }
  }
  return cookieDir;
};

const saveCookies = async (slotId, context) => {
  try {
    if (!context || context.isClosed?.()) return;
    const cookiePath = path.join(getCookieStoragePath(), `slot-${slotId}.json`);
    const cookies = await context.cookies();
    fs.writeFileSync(cookiePath, JSON.stringify(cookies, null, 2));
  } catch (e) {
    console.error(`Failed to save cookies for slot ${slotId}:`, e);
  }
};

const loadCookies = async (slotId, context) => {
  try {
    if (!context || context.isClosed?.()) return;
    const cookiePath = path.join(getCookieStoragePath(), `slot-${slotId}.json`);
    if (fs.existsSync(cookiePath)) {
      const cookies = JSON.parse(fs.readFileSync(cookiePath, 'utf-8'));
      await context.addCookies(cookies);
      console.log(`Loaded ${cookies.length} cookies for slot ${slotId}`);
    }
  } catch (e) {
    console.error(`Failed to load cookies for slot ${slotId}:`, e);
  }
};

// Proxy parsing helpers
const parseProxyLine = (line) => {
  line = line.trim();
  if (!line) return null;
  
  // Common formats:
  // ip:port
  // ip:port:username:password
  // protocol://ip:port
  // protocol://username:password@ip:port
  const patterns = [
    // protocol://username:password@host:port
    { regex: /^(https?|socks[45]?):\/\/([^:]+):([^@]+)@([^:]+):(\d+)$/i, fields: ['type', 'username', 'password', 'host', 'port'] },
    // protocol://host:port
    { regex: /^(https?|socks[45]?):\/\/([^:]+):(\d+)$/i, fields: ['type', 'host', 'port'] },
    // host:port:username:password
    { regex: /^([^:]+):(\d+):([^:]+):(.+)$/, fields: ['host', 'port', 'username', 'password'], defaultType: 'http' },
    // host:port
    { regex: /^([^:]+):(\d+)$/, fields: ['host', 'port'], defaultType: 'http' },
  ];

  for (const { regex, fields, defaultType } of patterns) {
    const match = line.match(regex);
    if (match) {
      const proxy = {};
      fields.forEach((field, i) => {
        proxy[field] = match[i + 1];
      });
      if (defaultType && !proxy.type) {
        proxy.type = defaultType;
      }
      const port = parseInt(proxy.port);
      if (isNaN(port) || port <= 0 || port > 65535) {
        return null; // Invalid port
      }
      return {
        type: (proxy.type || 'http').toLowerCase().replace(/socks$/, 'socks5'),
        host: proxy.host,
        port: port,
        username: proxy.username || undefined,
        password: proxy.password || undefined,
      };
    }
  }

  return null;
};

const parseProxies = (content) => {
  console.log('[parseProxies] Starting to parse content with length:', content?.length);
  const proxies = [];
  
  // Try JSON first
  try {
    const jsonData = JSON.parse(content);
    if (Array.isArray(jsonData)) {
      console.log('[parseProxies] Parsed as JSON array with', jsonData.length, 'items');
      jsonData.forEach((item, index) => {
        console.log(`[parseProxies] JSON item ${index}:`, item);
        if (item.host && item.port) {
          const parsed = {
            type: (item.type || 'http').toLowerCase(),
            host: item.host,
            port: parseInt(item.port),
            username: item.username || item.user || undefined,
            password: item.password || item.pass || undefined,
            country: item.country || undefined,
            timezone: item.timezone || undefined,
            language: item.language || 'en-US',
          };
          proxies.push(parsed);
          console.log('[parseProxies] Added JSON proxy:', parsed);
        }
      });
      return proxies;
    }
  } catch (e) { 
    console.log('[parseProxies] Not valid JSON, continuing to line-by-line');
  }

  // Try line-by-line
  const lines = content.split(/[\r\n]+/);
  console.log('[parseProxies] Line-by-line parsing, number of lines:', lines.length);
  lines.forEach((line, index) => {
    console.log(`[parseProxies] Line ${index}: "${line}"`);
    const proxy = parseProxyLine(line);
    if (proxy) {
      proxies.push({
        ...proxy,
        language: 'en-US',
      });
      console.log('[parseProxies] Added proxy from line:', proxy);
    } else {
      console.log('[parseProxies] Failed to parse line as proxy');
    }
  });

  console.log('[parseProxies] Finished parsing, total proxies found:', proxies.length);
  return proxies;
};

// Proxy testing helper
const testProxy = async (proxy) => {
  let browser;
  const startTime = Date.now();
  try {
    // Build proxy options
    const launchOptions = {
      headless: true,
      args: ['--no-sandbox'],
    };

    if (proxy) {
      let proxyServer = `${proxy.type}://${proxy.host}:${proxy.port}`;
      if (proxy.username && proxy.password) {
        proxyServer = `${proxy.type}://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`;
      }
      launchOptions.proxy = { server: proxyServer };
    }

    // Launch browser with proxy
    browser = await chromium.launch(launchOptions);
    const context = await browser.newContext({
      locale: proxy?.language || 'en-US',
      timezoneId: proxy?.timezone || 'America/New_York',
    });
    const page = await context.newPage();

    // Test with multiple services
    const results = {
      working: false,
      speed: null,
      exposed: false,
      banned: false,
      ip: null,
      country: null,
      error: null,
    };

    try {
      // Test 1: Check if proxy is working by visiting httpbin.org
      await page.goto('https://httpbin.org/ip', { waitUntil: 'domcontentloaded', timeout: 15000 });
      const ipData = await page.evaluate(() => {
        try {
          return JSON.parse(document.body.textContent || '{}');
        } catch (e) {
          return null;
        }
      });
      results.working = true;
      results.ip = ipData?.origin;

      // Test 2: Check if proxy is exposed (detect proxy)
      try {
        await page.goto('https://httpbin.org/headers', { waitUntil: 'domcontentloaded', timeout: 10000 });
        const headersText = await page.evaluate(() => document.body.textContent || '');
        const headers = JSON.parse(headersText)?.headers || {};
        results.exposed = !!(
          headers['X-Forwarded-For'] ||
          headers['X-Forwarded-Host'] ||
          headers['X-Forwarded-Server'] ||
          headers['Via'] ||
          headers['Proxy-Agent'] ||
          headers['Proxy-Connection'] ||
          headers['Cache-Control']?.includes('proxy')
        );
      } catch (e) {
        console.log('Exposed test skipped:', e.message);
      }

      // Test 3: Get geolocation info (country)
      try {
        await page.goto('https://ipapi.co/json/', { waitUntil: 'domcontentloaded', timeout: 10000 });
        const geoData = await page.evaluate(() => {
          try {
            return JSON.parse(document.body.textContent || '{}');
          } catch (e) {
            return null;
          }
        });
        results.country = geoData?.country_code;
      } catch (e) {
        console.log('Geolocation test skipped:', e.message);
      }

    } catch (e) {
      results.working = false;
      results.error = e.message;
      // Check if error looks like a ban
      if (
        e.message.includes('403') ||
        e.message.includes('429') ||
        e.message.includes('503') ||
        e.message.toLowerCase().includes('banned') ||
        e.message.toLowerCase().includes('blocked') ||
        e.message.toLowerCase().includes('unavailable')
      ) {
        results.banned = true;
      }
    }

    // Calculate speed (time to complete)
    const endTime = Date.now();
    results.speed = endTime - startTime;

    await browser.close();
    return results;
  } catch (e) {
    console.error('Proxy test error:', e);
    if (browser) {
      try { await browser.close(); } catch (closeErr) { /* ignore */ }
    }
    const endTime = Date.now();
    return {
      working: false,
      speed: endTime - startTime,
      exposed: false,
      banned: e.message.includes('403') || e.message.includes('banned') || e.message.includes('blocked'),
      ip: null,
      country: null,
      error: e.message,
    };
  }
};

// Proxy scraping helper
const scrapeProxiesFromUrl = async (url) => {
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox'],
    });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    const content = await page.content();
    // Extract text content
    const text = await page.evaluate(() => document.body.textContent || '');
    await browser.close();
    return parseProxies(text);
  } catch (e) {
    console.error('Proxy scraping error:', e);
    if (browser) await browser.close();
    throw e;
  }
};

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Expose main window reference for sending challenge/alarm events
  try { global.mainWindowRef = mainWindow; } catch (e) { /* ignore */ }

  if (!app.isPackaged) {
    mainWindow.loadURL("http://localhost:8081");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
};

// Wait for a URL to become reachable (simple retry loop)
const waitForUrl = (targetUrl, { timeout = 15000, interval = 500 } = {}) => {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    const check = () => {
      try {
        const parsed = new URL(targetUrl);
        const getter = parsed.protocol === 'https:' ? https : http;
        const req = getter.request({ method: 'HEAD', host: parsed.hostname, port: parsed.port, path: parsed.pathname || '/' }, (res) => {
          // Any 2xx-3xx-4xx response means server is up (we treat 5xx as transient)
          if (res.statusCode && res.statusCode < 600) {
            resolve();
          } else {
            if (Date.now() - start > timeout) reject(new Error('timeout'));
            else setTimeout(check, interval);
          }
        });
        req.on('error', (err) => {
          if (Date.now() - start > timeout) return reject(err);
          setTimeout(check, interval);
        });
        req.setTimeout(interval, () => req.abort());
        req.end();
      } catch (e) {
        if (Date.now() - start > timeout) return reject(e);
        setTimeout(check, interval);
      }
    };

    check();
  });
};

// Speed multiplier for faster human-like behavior (0.6 = 40% faster)
const SPEED_MULTIPLIER = 0.6;

// Auto-click common cookie / consent dialogs and detect Cloudflare-like challenges
const AUTO_CLICK_SELECTORS = [
  'button:has-text("Accept")',
  'button:has-text("Agree")',
  'button:has-text("I agree")',
  'button:has-text("Accept all")',
  'button:has-text("Accept all cookies")',
  'button[aria-label*="accept"]',
  'button.cookie-consent, .cookie-consent button',
  '[role="dialog"] button:has-text("Accept")',
];

// Mouse drag helper for press-and-hold captcha handling
async function handleMouseDragCaptcha(page, element, durationMs = 1000) {
  try {
    if (!isPageOpen(page) || !element) return false;
    
    const box = await element.boundingBox();
    if (!box) return false;

    // Calculate center of element
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    // Move to element first
    await page.mouse.move(centerX - 50, centerY, { steps: 10 });
    await new Promise(r => setTimeout(r, 100 + Math.random() * 200));

    // Press mouse down at start position
    await page.mouse.down();
    await new Promise(r => setTimeout(r, 50 + Math.random() * 100));

    // Move to end position with realistic curve
    const endX = box.x + box.width - 20;
    const endY = centerY + (Math.random() - 0.5) * 10;
    
    // Create Bezier path for natural movement
    const path = createBezierPath(centerX - 50, centerY, endX, endY, 40);
    
    const stepDuration = durationMs / path.length;
    for (let i = 0; i < path.length; i++) {
      const point = path[i];
      await page.mouse.move(point.x, point.y);
      // Vary speed slightly for natural feel
      const variance = (Math.random() - 0.5) * 0.3;
      await new Promise(r => setTimeout(r, stepDuration * (1 + variance)));
    }

    // Hold at end position briefly
    await new Promise(r => setTimeout(r, 200 + Math.random() * 500));

    // Release mouse
    await page.mouse.up();
    await new Promise(r => setTimeout(r, 100 + Math.random() * 300));
    
    return true;
  } catch (error) {
    console.error('Error handling mouse drag captcha:', error);
    return false;
  }
}

async function autoHandleConsentAndChallenges(slotId, page) {
  try {
    // Give the page a short time to render consent dialogs
    await page.waitForTimeout(400);

    // Try selectors
    for (const sel of AUTO_CLICK_SELECTORS) {
      try {
        const handle = await page.$(sel);
        if (handle) {
          try {
            await handle.click({ delay: 50 });
            console.log(`[autoClick] Clicked ${sel} for slot ${slotId}`);
            await page.waitForTimeout(200);
            return; // clicked something, stop
          } catch (e) {
            // ignore and continue
          }
        }
      } catch (e) {
        // ignore selector errors
      }
    }

    // Try to detect and handle press-and-hold captcha buttons
    try {
      const dragButtons = await page.$$('[class*="drag"], [class*="hold"], [class*="press"], button:has-text("PRESS & HOLD"), button:has-text("Hold")');
      for (const btn of dragButtons) {
        const text = await btn.textContent();
        if (text && (text.includes('PRESS') || text.includes('hold') || text.includes('drag'))) {
          console.log(`[captcha] Detected press-and-hold captcha for slot ${slotId}`);
          const success = await handleMouseDragCaptcha(page, btn, 1500 + Math.random() * 500);
          if (success) {
            console.log(`[captcha] Successfully completed drag captcha for slot ${slotId}`);
            await page.waitForTimeout(500);
            return;
          }
        }
      }
    } catch (e) {
      // ignore captcha detection errors
    }

    // Try to detect and solve reCAPTCHA with 2Captcha if API key is available
    if (captchaSolver.API_KEY) {
      try {
        // Check for reCAPTCHA v2
        const recaptchaFrame = await page.$('iframe[src*="recaptcha"], iframe[title*="reCAPTCHA"]');
        if (recaptchaFrame) {
          console.log(`[2Captcha] Detected reCAPTCHA iframe in slot ${slotId}`);
          
          // Extract sitekey from page
          const siteKey = await page.evaluate(() => {
            const elem = document.querySelector('[data-sitekey]');
            return elem ? elem.getAttribute('data-sitekey') : null;
          });
          
          if (siteKey) {
            const solution = await captchaSolver.solveRecaptcha(siteKey, page.url(), 'v2');
            if (solution) {
              // Inject solution into page
              await page.evaluate((token) => {
                document.getElementById('g-recaptcha-response').innerHTML = token;
                if (window.__grecaptcha_cb) window.__grecaptcha_cb();
              }, solution);
              console.log(`[2Captcha] Injected reCAPTCHA solution for slot ${slotId}`);
              await page.waitForTimeout(1000);
              return;
            }
          }
        }
        
        // Check for image captchas (hCaptcha, other image-based)
        const captchaImages = await page.$$('img[alt*="captcha"], img[title*="captcha"], [class*="captcha"] img');
        if (captchaImages.length > 0) {
          console.log(`[2Captcha] Detected image captcha in slot ${slotId}`);
          
          const solution = await captchaSolver.solveCaptchaOnPage(page, captchaImages[0]);
          if (solution) {
            // Try common captcha input field names
            const inputFields = await page.$$('input[name*="captcha"], input[class*="captcha"], input[placeholder*="captcha"]');
            if (inputFields.length > 0) {
              await inputFields[0].fill(solution);
              console.log(`[2Captcha] Filled captcha solution for slot ${slotId}`);
              await page.waitForTimeout(500);
              return;
            }
          }
        }
      } catch (e) {
        console.error('[2Captcha] Failed to solve captcha:', e.message);
      }
    }

    // If no consent found, check for Cloudflare or challenge indicators
    const url = page.url();
    const title = (await page.title()).toLowerCase();
    const content = (await page.content()).toLowerCase();

    const isCloudflare = url.includes('cloudflare') || title.includes('checking your browser') || content.includes('checking your browser') || content.includes('cf-chl-bypass');
    const isChallenge = isCloudflare || content.includes('please enable javascript') || content.includes('are you human') || content.includes('verify you are human');

    if (isChallenge) {
      console.warn(`[challenge] Detected challenge in slot ${slotId} at ${url}`);
      // Notify renderer to show alarm so user can intervene
      try {
        if (global.mainWindowRef && global.mainWindowRef.webContents && !global.mainWindowRef.isDestroyed()) {
          global.mainWindowRef.webContents.send('surf:challenge', { slotId, url, reason: 'challenge-detected' });
        }
      } catch (e) { /* ignore */ }
    }
  } catch (e) {
    console.error('autoHandleConsentAndChallenges failed:', e);
  }
}

// Disable GPU and sandbox for testing - must set before app is ready
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-software-rasterizer');

app.whenReady().then(async () => {
  initDatabase(app);

  // Load 2Captcha API key from config file if it exists
  try {
    const configPath = path.join(app.getPath('userData'), '2captcha-config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (config.apiKey) {
        captchaSolver.setApiKey(config.apiKey);
        console.log('[2Captcha] API key loaded from config');
      }
    }
  } catch (e) {
    console.error('Failed to load 2Captcha config:', e);
  }

  // Check for updates in packaged builds (don't check in dev)
  if (autoUpdater && app.isPackaged) {
    try {
      // Give app a moment to finish startup
      setTimeout(() => {
        try { autoUpdater.checkForUpdates().catch(() => {}); } catch (e) { /* ignore */ }
      }, 5000);
    } catch (e) {
      console.error('Failed to start auto-updater:', e);
    }
  }

  if (!app.isPackaged) {
    try {
      // Wait up to 15s for the dev server to be reachable to avoid chrome-error pages
      await waitForUrl('http://localhost:8081', { timeout: 15000, interval: 500 });
    } catch (e) {
      console.warn('Dev server did not respond in time, continuing to create window:', e && e.message);
    }
  }

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", async () => {
  // Clean up all browsers on close
  await closeAllBrowsers();

  if (process.platform !== "darwin") app.quit();
});

// IPC handlers to allow renderer to trigger update checks and install
ipcMain.handle('update:check', async () => {
  if (!autoUpdater) return { error: 'auto-updater-not-available' };
  try {
    const res = await autoUpdater.checkForUpdates();
    return { success: true, info: res };
  } catch (e) {
    console.error('update:check error', e);
    return { success: false, error: e && e.message };
  }
});

ipcMain.handle('update:install', async () => {
  if (!autoUpdater) return { error: 'auto-updater-not-available' };
  try {
    // This will quit the app and install the update
    autoUpdater.quitAndInstall();
    return { success: true };
  } catch (e) {
    console.error('update:install error', e);
    return { success: false, error: e && e.message };
  }
});

ipcMain.handle('db:query', (event, sql, params = []) => {
  try {
    const db = getDb();
    const stmt = db.prepare(sql);
    if (sql.trim().toUpperCase().startsWith('SELECT')) {
      return stmt.all(...params);
    } else {
      const result = stmt.run(...params);
      return { changes: result.changes, lastInsertRowid: result.lastInsertRowid };
    }
  } catch (error) {
    console.error('Database query error:', error);
    try {
      console.error('Failed SQL:', sql);
      console.error('Params:', params);
    } catch (e) {
      // ignore
    }
    // If FK constraint failed when inserting with missing user, try to return a clearer message
    if (error && error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
      const ex = new Error('FOREIGN_KEY_FAILED');
      ex.sql = sql;
      ex.params = params;
      throw ex;
    }
    throw error;
  }
});

ipcMain.handle('user:get', async (event, userId) => {
  try {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    const user = stmt.get(userId);
    if (user) {
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
        bio: user.bio,
        role: user.role,
        credits: user.credits,
        createdAt: user.created_at,
        lastLoginAt: user.last_login_at,
        lastLoginIp: user.last_login_ip,
        lastDevice: user.last_device,
        lastLocation: user.last_location,
        lastUserAgent: user.last_user_agent,
        lastCountry: user.last_country,
        lastRegion: user.last_region,
        lastCity: user.last_city,
        referralCode: `REF-${user.id.slice(0, 6).toUpperCase()}`,
        emailVerified: true,
        referredBy: null
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting user:', error);
    throw error;
  }
});

ipcMain.handle('user:list', async () => {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
    return rows.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatar: user.avatar,
      bio: user.bio,
      role: user.role,
      credits: user.credits,
      createdAt: user.created_at,
      lastLoginAt: user.last_login_at,
      lastLoginIp: user.last_login_ip,
      lastDevice: user.last_device,
      lastLocation: user.last_location,
      lastUserAgent: user.last_user_agent,
      lastCountry: user.last_country,
      lastRegion: user.last_region,
      lastCity: user.last_city,
      storeRawIps: user.store_raw_ips === 1,
    }));
  } catch (error) {
    console.error('Error listing users:', error);
    throw error;
  }
});

ipcMain.handle('user:upsert', async (event, user) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(user.id);
    if (existing) {
      const updates = [];
      const params = [];
      if (user.name !== undefined) { updates.push('name = ?'); params.push(user.name); }
      if (user.email !== undefined) { updates.push('email = ?'); params.push(user.email); }
      if (user.phone !== undefined) { updates.push('phone = ?'); params.push(user.phone); }
      if (user.avatar !== undefined) { updates.push('avatar = ?'); params.push(user.avatar); }
      if (user.bio !== undefined) { updates.push('bio = ?'); params.push(user.bio); }
      if (user.credits !== undefined) { updates.push('credits = ?'); params.push(user.credits); }
      if (user.role !== undefined) { updates.push('role = ?'); params.push(user.role); }
      if (user.store_raw_ips !== undefined) { updates.push('store_raw_ips = ?'); params.push(user.store_raw_ips ? 1 : 0); }
      if (user.lastLoginAt !== undefined) { updates.push('last_login_at = ?'); params.push(user.lastLoginAt); }
      if (user.lastLoginIp !== undefined) { updates.push('last_login_ip = ?'); params.push(user.lastLoginIp); }
      if (user.lastDevice !== undefined) { updates.push('last_device = ?'); params.push(user.lastDevice); }
      if (user.lastLocation !== undefined) { updates.push('last_location = ?'); params.push(user.lastLocation); }
      if (user.lastUserAgent !== undefined) { updates.push('last_user_agent = ?'); params.push(user.lastUserAgent); }
      if (user.lastCountry !== undefined) { updates.push('last_country = ?'); params.push(user.lastCountry); }
      if (user.lastRegion !== undefined) { updates.push('last_region = ?'); params.push(user.lastRegion); }
      if (user.lastCity !== undefined) { updates.push('last_city = ?'); params.push(user.lastCity); }
      if (user.createdAt !== undefined) { updates.push('created_at = ?'); params.push(user.createdAt); }
      if (updates.length > 0) {
        const stmt = db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`);
        stmt.run(...params, user.id);
      }
    } else {
      const stmt = db.prepare(`INSERT INTO users (
        id, name, email, phone, role, credits, avatar, bio, store_raw_ips,
        last_login_at, last_login_ip, last_device, last_location, last_user_agent,
        last_country, last_region, last_city, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      stmt.run(
        user.id,
        user.name,
        user.email || null,
        user.phone || null,
        user.role || 'user',
        user.credits ?? 250,
        user.avatar || null,
        user.bio || null,
        user.store_raw_ips ? 1 : 0,
        user.lastLoginAt || null,
        user.lastLoginIp || null,
        user.lastDevice || null,
        user.lastLocation || null,
        user.lastUserAgent || null,
        user.lastCountry || null,
        user.lastRegion || null,
        user.lastCity || null,
        user.createdAt || new Date().toISOString()
      );
    }
    const getStmt = db.prepare('SELECT * FROM users WHERE id = ?');
    const saved = getStmt.get(user.id);
    return {
      id: saved.id,
      name: saved.name,
      email: saved.email,
      phone: saved.phone,
      avatar: saved.avatar,
      bio: saved.bio,
      role: saved.role,
      credits: saved.credits,
      createdAt: saved.created_at,
      lastLoginAt: saved.last_login_at,
      lastLoginIp: saved.last_login_ip,
      lastDevice: saved.last_device,
      lastLocation: saved.last_location,
      lastUserAgent: saved.last_user_agent,
      lastCountry: saved.last_country,
      lastRegion: saved.last_region,
      lastCity: saved.last_city,
      storeRawIps: saved.store_raw_ips === 1,
    };
  } catch (error) {
    console.error('Error upserting user:', error);
    throw error;
  }
});

ipcMain.handle('user:track-login', async (event, userId, meta) => {
  try {
    const db = getDb();
    const updates = [];
    const params = [];
    if (meta.lastLoginAt !== undefined) { updates.push('last_login_at = ?'); params.push(meta.lastLoginAt); }
    if (meta.lastLoginIp !== undefined) { updates.push('last_login_ip = ?'); params.push(meta.lastLoginIp); }
    if (meta.lastDevice !== undefined) { updates.push('last_device = ?'); params.push(meta.lastDevice); }
    if (meta.lastLocation !== undefined) { updates.push('last_location = ?'); params.push(meta.lastLocation); }
    if (meta.lastUserAgent !== undefined) { updates.push('last_user_agent = ?'); params.push(meta.lastUserAgent); }
    if (meta.lastCountry !== undefined) { updates.push('last_country = ?'); params.push(meta.lastCountry); }
    if (meta.lastRegion !== undefined) { updates.push('last_region = ?'); params.push(meta.lastRegion); }
    if (meta.lastCity !== undefined) { updates.push('last_city = ?'); params.push(meta.lastCity); }
    if (updates.length > 0) {
      const stmt = db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`);
      stmt.run(...params, userId);
    }
    const insertStmt = db.prepare(`INSERT INTO user_login_history (
      id, user_id, last_login_at, last_login_ip, last_device, last_location,
      last_user_agent, last_country, last_region, last_city, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    insertStmt.run(
      `login_${userId}_${Date.now()}`,
      userId,
      meta.lastLoginAt || null,
      meta.lastLoginIp || null,
      meta.lastDevice || null,
      meta.lastLocation || null,
      meta.lastUserAgent || null,
      meta.lastCountry || null,
      meta.lastRegion || null,
      meta.lastCity || null,
      new Date().toISOString()
    );
    return { success: true };
  } catch (error) {
    console.error('Error tracking login:', error);
    throw error;
  }
});

ipcMain.handle('user:delete', async (event, userId) => {
  try {
    const db = getDb();
    const stmt = db.prepare('DELETE FROM users WHERE id = ?');
    const result = stmt.run(userId);
    return { success: result.changes > 0 };
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
});

ipcMain.handle('user:history', async (event, userId) => {
  try {
    const db = getDb();
    const rows = db.prepare(`SELECT * FROM user_login_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`).all(userId);
    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      lastLoginAt: row.last_login_at,
      lastLoginIp: row.last_login_ip,
      lastDevice: row.last_device,
      lastLocation: row.last_location,
      lastUserAgent: row.last_user_agent,
      lastCountry: row.last_country,
      lastRegion: row.last_region,
      lastCity: row.last_city,
      createdAt: row.created_at,
    }));
  } catch (error) {
    console.error('Error fetching user login history:', error);
    throw error;
  }
});

// Human-like behavior helpers

// Helper to create natural Bezier curve points between start and end
function createBezierPath(startX, startY, endX, endY, numSteps = 50) {
  // Create two random control points
  const cp1x = startX + (Math.random() - 0.3) * (endX - startX) * 1.2;
  const cp1y = startY + (Math.random() - 0.5) * (endY - startY) * 0.8;
  const cp2x = endX + (Math.random() - 0.7) * (endX - startX) * 1.2;
  const cp2y = endY + (Math.random() - 0.5) * (endY - startY) * 0.8;

  const points = [];
  for (let t = 0; t <= 1; t += 1 / numSteps) {
    // Cubic Bezier formula
    const x = Math.pow(1 - t, 3) * startX +
              3 * Math.pow(1 - t, 2) * t * cp1x +
              3 * (1 - t) * Math.pow(t, 2) * cp2x +
              Math.pow(t, 3) * endX;
    const y = Math.pow(1 - t, 3) * startY +
              3 * Math.pow(1 - t, 2) * t * cp1y +
              3 * (1 - t) * Math.pow(t, 2) * cp2y +
              Math.pow(t, 3) * endY;
    points.push({ x, y });
  }
  return points;
}

async function multiTabBrowsing(context, mainPage, durationMs) {
  try {
    // 20% chance to do multi-tab browsing
    if (Math.random() > 0.8) return;
    
    const numTabs = 2 + Math.floor(Math.random() * 2); // 2-3 tabs
    const tabs = [mainPage];
    
    // Open new tabs with random URLs (using some common sites)
    const randomUrls = [
      'https://www.wikipedia.org',
      'https://www.reddit.com',
      'https://news.ycombinator.com',
      'https://github.com',
      'https://stackoverflow.com'
    ];
    
    for (let i = 1; i < numTabs; i++) {
      const newTab = await context.newPage();
      const randomUrl = randomUrls[Math.floor(Math.random() * randomUrls.length)];
      try {
        await newTab.goto(randomUrl, { waitUntil: 'networkidle', timeout: 10000 });
        tabs.push(newTab);
      } catch (e) {
        console.error('Failed to load random tab:', e);
        await newTab.close();
      }
      await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
    }
    
    // Switch between tabs
    const startTime = Date.now();
    const endTime = startTime + Math.min(durationMs, 15000); // Max 15s of tab switching
    
    while (Date.now() < endTime) {
      // Pick a random tab
      const randomIndex = Math.floor(Math.random() * tabs.length);
      const activeTab = tabs[randomIndex];
      
      // Bring to front (we just interact with it)
      await new Promise(r => setTimeout(r, 500 + Math.random() * 1000));
      
      // Do a small action on the tab
      if (Math.random() > 0.5) {
        try {
          await activeTab.mouse.move(100 + Math.random() * 200, 100 + Math.random() * 200);
          await new Promise(r => setTimeout(r, 300 + Math.random() * 700));
        } catch (e) {
          // Ignore
        }
      }
    }
    
    // Close extra tabs, leave only main page
    for (let i = 1; i < tabs.length; i++) {
      try {
        await tabs[i].close();
      } catch (e) {
        // Ignore
      }
    }
    
  } catch (error) {
    console.error('Error during multi-tab browsing:', error);
  }
}

function isPageOpen(page) {
  try {
    return page && !page.isClosed?.();
  } catch {
    return false;
  }
}

async function simulateHumanMovement(page, durationMs, profile = null) {
  try {
    if (!isPageOpen(page)) return;

    // Get user profile and time-based multiplier if not provided
    const userProfile = profile || getRandomUserProfile();
    const timeMultiplier = getTimeBasedMultiplier();
    const combinedMultiplier = userProfile.pauseMultiplier * timeMultiplier * SPEED_MULTIPLIER;
    
    const viewport = page.viewportSize();
    const endTime = Date.now() + durationMs;
    let lastX = viewport ? viewport.width / 2 : 500;
    let lastY = viewport ? viewport.height / 2 : 400;

    // Start with either scrolling or viewport scan
    if (Math.random() > 0.5) {
      await scrollWithBacktracking(page, userProfile);
    } else {
      await scanViewport(page, userProfile);
    }

    // Maybe do some keyboard navigation early
    await keyboardNavigation(page, userProfile);

    while (Date.now() < endTime) {
      if (!isPageOpen(page)) return;

      // Random target position
      const targetX = Math.max(50, Math.min((viewport?.width || 1230), lastX + (Math.random() - 0.5) * (viewport?.width || 1230) * 0.4));
      const targetY = Math.max(50, Math.min((viewport?.height || 670), lastY + (Math.random() - 0.5) * (viewport?.height || 670) * 0.4));
      
      // Create Bezier path and move along it (faster)
      const path = createBezierPath(lastX, lastY, targetX, targetY, 20 + Math.floor(Math.random() * 25));
      for (const point of path) {
        if (!isPageOpen(page)) return;
        await page.mouse.move(point.x, point.y);
        // Random micro-pause between steps (faster)
        await new Promise(r => setTimeout(r, (3 + Math.random() * 12) * userProfile.typingSpeed * SPEED_MULTIPLIER));
      }
      
      lastX = targetX;
      lastY = targetY;

      // Scrolling with backtracking (reduced chance)
      if (Math.random() > 0.7) {
        await scrollWithBacktracking(page, userProfile);
      }
      
      // Viewport scan (reduced chance)
      if (Math.random() > 1 - userProfile.viewportScanChance * 0.8) {
        await scanViewport(page, userProfile);
      }

      // Keyboard navigation (reduced chance)
      if (Math.random() > 0.6) {
        await keyboardNavigation(page, userProfile);
      }

      // Text selection (reduced chance)
      if (Math.random() > 0.8) {
        await selectText(page, userProfile);
      }

      // Random reading pause with multipliers (shorter)
      const pauseTime = (300 + Math.random() * 3500) * combinedMultiplier;
      await new Promise(r => setTimeout(r, pauseTime));

      // Random click (reduced chance)
      const clickThreshold = 1 - (0.1 * userProfile.clickFrequency);
      if (Math.random() > clickThreshold) {
        try {
          // Hover before clicking (faster)
          await new Promise(r => setTimeout(r, (50 + Math.random() * 100) * combinedMultiplier));
          await page.mouse.click(lastX, lastY);
          await new Promise(r => setTimeout(r, (100 + Math.random() * 250) * combinedMultiplier));
        } catch (e) {
          // Ignore click errors
        }
      }

      // Jitter movement (reduced chance)
      const jitterThreshold = 1 - (0.05 * userProfile.jitterFrequency);
      if (Math.random() > jitterThreshold) {
        for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) {
          const jitterX = lastX + (Math.random() - 0.5) * 10;
          const jitterY = lastY + (Math.random() - 0.5) * 10;
          await page.mouse.move(jitterX, jitterY);
          await new Promise(r => setTimeout(r, (5 + Math.random() * 15) * userProfile.typingSpeed * SPEED_MULTIPLIER));
        }
        await page.mouse.move(lastX, lastY);
      }
    }
  } catch (error) {
    console.error('Error simulating human movement:', error);
  }
}

async function scanViewport(page, profile = USER_PROFILES['Average Joe']) {
  try {
    if (!isPageOpen(page)) return;
    const viewport = page.viewportSize();
    if (!viewport) return;
    const timeMultiplier = getTimeBasedMultiplier();

    // Start from center or current position
    const startX = viewport.width / 2;
    const startY = viewport.height / 2;

    // First, scan top-to-bottom, left-to-right (reading pattern)
    if (Math.random() > 0.5) {
      // Left-to-right, top-to-bottom scan
      for (let y = 100; y < viewport.height - 100; y += 100 + Math.random() * 50) {
        for (let x = 100; x < viewport.width - 100; x += 150 + Math.random() * 100) {
          // Add some jitter to make it natural
          const targetX = x + (Math.random() - 0.5) * 30;
          const targetY = y + (Math.random() - 0.5) * 30;
          
          // Move to position
          await page.mouse.move(targetX, targetY, { steps: 8 + Math.floor(Math.random() * 5) });
          
          // Pause like reading
          await new Promise(r => setTimeout(r, (100 + Math.random() * 300) * profile.pauseMultiplier * timeMultiplier));
        }
      }
    } else {
      // Spiral scan or random exploration
      const points = [];
      for (let i = 0; i < 8 + Math.floor(Math.random() * 5); i++) {
        points.push({
          x: 100 + Math.random() * (viewport.width - 200),
          y: 100 + Math.random() * (viewport.height - 200)
        });
      }
      
      for (const point of points) {
        await page.mouse.move(point.x, point.y, { steps: 10 + Math.floor(Math.random() * 10) });
        await new Promise(r => setTimeout(r, (150 + Math.random() * 400) * profile.pauseMultiplier * timeMultiplier));
      }
    }
  } catch (error) {
    console.error('Error during viewport scan:', error);
  }
}

async function keyboardNavigation(page, profile = USER_PROFILES['Average Joe']) {
  try {
    if (!isPageOpen(page)) return;
    // Chance based on profile
    if (Math.random() > profile.keyboardNavChance) return;
    const timeMultiplier = getTimeBasedMultiplier();

    const actions = [];
    
    // Decide what keys to press
    if (Math.random() > 0.5) {
      // Page down
      actions.push({ key: 'PageDown', count: 1 + Math.floor(Math.random() * 2) });
    }
    
    if (Math.random() > 0.7) {
      // Some arrow keys
      const directions = ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'];
      const dir = directions[Math.floor(Math.random() * directions.length)];
      actions.push({ key: dir, count: 3 + Math.floor(Math.random() * 5) });
    }
    
    if (Math.random() > 0.8) {
      // Space to scroll
      actions.push({ key: ' ', count: 1 + Math.floor(Math.random() * 2) });
    }
    
    // Execute the key presses
    for (const action of actions) {
      if (!isPageOpen(page)) return;
      for (let i = 0; i < action.count; i++) {
        if (!isPageOpen(page)) return;
        await page.keyboard.press(action.key);
        await new Promise(r => setTimeout(r, (50 + Math.random() * 100) * profile.typingSpeed));
      }
      await new Promise(r => setTimeout(r, (300 + Math.random() * 700) * profile.pauseMultiplier * timeMultiplier));
    }
  } catch (error) {
    console.error('Error during keyboard navigation:', error);
  }
}

async function selectText(page, profile = USER_PROFILES['Average Joe']) {
  try {
    if (!isPageOpen(page)) return;
    // Chance based on profile
    if (Math.random() > profile.textSelectChance) return;

    // Get viewport
    const viewport = page.viewportSize();
    if (!viewport) return;

    // Pick a random area to select
    const startX = 100 + Math.random() * (viewport.width - 300);
    const startY = 100 + Math.random() * (viewport.height - 200);
    const endX = startX + 100 + Math.random() * 200;
    const endY = startY + 20 + Math.random() * 80;

    // Move to start position
    if (!isPageOpen(page)) return;
    await page.mouse.move(startX, startY, { steps: 10 });
    await new Promise(r => setTimeout(r, 100 + Math.random() * 200));

    // Press mouse down
    if (!isPageOpen(page)) return;
    await page.mouse.down();
    await new Promise(r => setTimeout(r, 50 + Math.random() * 100));

    // Move to end position (selecting text)
    if (!isPageOpen(page)) return;
    await page.mouse.move(endX, endY, { steps: 15 + Math.floor(Math.random() * 10) });
    await new Promise(r => setTimeout(r, 200 + Math.random() * 500));

    // Release mouse
    if (!isPageOpen(page)) return;
    await page.mouse.up();
    
    // Keep text selected for a moment
    await new Promise(r => setTimeout(r, 500 + Math.random() * 1000));
    
    // Click somewhere to deselect (50% chance)
    if (Math.random() > 0.5) {
      if (!isPageOpen(page)) return;
      const deselectX = 50 + Math.random() * (viewport.width - 100);
      const deselectY = 50 + Math.random() * (viewport.height - 100);
      await page.mouse.click(deselectX, deselectY);
    }
  } catch (error) {
    console.error('Error during text selection:', error);
  }
}

async function navigateInternalLinks(page, maxLinks = 2) {
  try {
    if (!isPageOpen(page)) return;
    // Get all internal links with their selectors
    const links = await page.$$eval('a[href]', anchors => {
      const base = window.location.origin;
      return anchors
        .map((a, index) => ({
          href: a.href,
          text: a.textContent?.trim(),
          selector: `a:nth-of-type(${index + 1})`
        }))
        .filter(link => link.href.startsWith(base) && link.text && link.text.length > 0);
    });

    if (links.length > 0) {
      const numClicks = Math.min(maxLinks, links.length);
      const usedIndices = new Set();

      for (let i = 0; i < numClicks; i++) {
        if (!isPageOpen(page)) return;
        if (Math.random() > 0.4) continue; // 60% chance to skip, more natural

        let idx;
        do {
          idx = Math.floor(Math.random() * links.length);
        } while (usedIndices.has(idx) && usedIndices.size < links.length);

        if (!usedIndices.has(idx)) {
          usedIndices.add(idx);
          const link = links[idx];
          
          // Wait a bit before moving to link
          await new Promise(r => setTimeout(r, 500 + Math.random() * 1500));
          
          // Do some viewport scanning first
          await scanViewport(page);
          
          // Find the link element and hover before clicking
          try {
            if (!isPageOpen(page)) return;
            const elements = await page.$$('a[href]');
            if (elements[idx]) {
              // Hover and click using our helper function
              const box = await elements[idx].boundingBox();
              if (box) {
                // First move to a nearby position
                const nearX = box.x + box.width / 2 + (Math.random() - 0.5) * 100;
                const nearY = box.y + box.height / 2 + (Math.random() - 0.5) * 100;
                await page.mouse.move(nearX, nearY, { steps: 10 });
                
                await new Promise(r => setTimeout(r, 100 + Math.random() * 300));
                
                // Then move to the link
                const targetX = box.x + box.width / 2 + (Math.random() - 0.5) * box.width * 0.3;
                const targetY = box.y + box.height / 2 + (Math.random() - 0.5) * box.height * 0.3;
                await page.mouse.move(targetX, targetY, { steps: 15 });
                
                // Hover for a moment
                await new Promise(r => setTimeout(r, 200 + Math.random() * 500));
                
                // Then click and navigate
                await elements[idx].click();
                await page.waitForLoadState('networkidle', { timeout: 10000 });
                
                // Wait on the new page with some human movement
                await simulateHumanMovement(page, 1000 + Math.random() * 2000);
              }
            }
          } catch (e) {
            console.error('Error navigating internal link:', e);
            if (!isPageOpen(page)) return;
            // Fallback to direct navigation if needed
            try {
              await page.goto(link.href, { waitUntil: 'networkidle', timeout: 10000 });
              await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));
            } catch (fallbackError) {
              console.error('Fallback navigation also failed:', fallbackError);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error navigating internal links:', error);
  }
}

async function typeWithHumanLikeBehavior(page, element, text, profile = USER_PROFILES['Average Joe']) {
  if (!isPageOpen(page) || !element) return;
  try {
    if (element.isClosed?.()) return;
    // Common typos and mistakes
    const typos = {
    'a': ['q', 'w', 's', 'z'],
    'b': ['v', 'g', 'h', 'n'],
    'c': ['x', 'd', 'f', 'v'],
    'd': ['s', 'e', 'r', 'f', 'x', 'c'],
    'e': ['w', 'r', 'd', 's'],
    'f': ['d', 'r', 't', 'g', 'c', 'v'],
    'g': ['f', 't', 'y', 'h', 'v', 'b'],
    'h': ['g', 'y', 'u', 'j', 'b', 'n'],
    'i': ['u', 'o', 'j', 'k'],
    'j': ['h', 'u', 'i', 'k', 'n', 'm'],
    'k': ['j', 'i', 'o', 'l', 'm'],
    'l': ['k', 'o', 'p'],
    'm': ['n', 'j', 'k', ','],
    'n': ['b', 'h', 'j', 'm'],
    'o': ['i', 'p', 'k', 'l'],
    'p': ['o', 'l'],
    'q': ['w', 'a'],
    'r': ['e', 't', 'd', 'f'],
    's': ['a', 'w', 'e', 'd', 'x', 'z'],
    't': ['r', 'y', 'f', 'g'],
    'u': ['y', 'i', 'h', 'j'],
    'v': ['c', 'f', 'g', 'b'],
    'w': ['q', 'e', 'a', 's'],
    'x': ['z', 's', 'd', 'c'],
    'y': ['t', 'u', 'g', 'h'],
    'z': ['a', 's', 'x'],
    ' ': ['c', 'v', 'b', 'n', 'm']
  };
  const timeMultiplier = getTimeBasedMultiplier();

  let i = 0;
  while (i < text.length) {
    // Reduced typo chance (3% per character)
    if (Math.random() < 0.03 && text[i].toLowerCase() in typos) {
      const possibleTypos = typos[text[i].toLowerCase()];
      const typo = possibleTypos[Math.floor(Math.random() * possibleTypos.length)];
      
      // Type the typo (faster)
      await element.type(typo, { delay: (20 + Math.random() * 60) * profile.typingSpeed * SPEED_MULTIPLIER });
      
      // Small pause before correcting (faster)
      await new Promise(r => setTimeout(r, (30 + Math.random() * 100) * profile.typingSpeed * timeMultiplier * SPEED_MULTIPLIER));
      
      // Backspace to delete typo
      await element.press('Backspace');
      await new Promise(r => setTimeout(r, (30 + Math.random() * 60) * profile.typingSpeed * SPEED_MULTIPLIER));
    }
    
    // Type the correct character (faster)
    await element.type(text[i], { delay: (20 + Math.random() * 70) * profile.typingSpeed * SPEED_MULTIPLIER });
    
    // Reduced pause mid-typing (5% chance)
    if (Math.random() < 0.05) {
      await new Promise(r => setTimeout(r, (100 + Math.random() * 400) * profile.pauseMultiplier * timeMultiplier * SPEED_MULTIPLIER));
    }
    
    i++;
  }
  
  // Final pause after typing (faster)
  await new Promise(r => setTimeout(r, (200 + Math.random() * 400) * profile.pauseMultiplier * timeMultiplier * SPEED_MULTIPLIER));
  } catch (error) {
    console.error('Error in typeWithHumanLikeBehavior:', error);
  }
}

async function hoverBeforeClick(page, selector) {
  try {
    if (!isPageOpen(page)) return;
    const element = await page.$(selector);
    if (!element) return;
    
    // Get element position
    const box = await element.boundingBox();
    if (!box) return;
    
    // Move to element quickly
    const targetX = box.x + box.width / 2 + (Math.random() - 0.5) * box.width * 0.3;
    const targetY = box.y + box.height / 2 + (Math.random() - 0.5) * box.height * 0.3;
    
    // First move near the element (faster)
    const nearX = targetX + (Math.random() - 0.5) * 50;
    const nearY = targetY + (Math.random() - 0.5) * 50;
    await page.mouse.move(nearX, nearY, { steps: 5 });
    
    // Small pause (faster)
    await new Promise(r => setTimeout(r, (50 + Math.random() * 150) * SPEED_MULTIPLIER));
    
    // Then move to the element
    await page.mouse.move(targetX, targetY, { steps: 8 });
    
    // Hover for moment (faster)
    await new Promise(r => setTimeout(r, (100 + Math.random() * 250) * SPEED_MULTIPLIER));
    
    // Then click
    await element.click();
  } catch (error) {
    console.error('Error in hoverBeforeClick:', error);
  }
}

async function scrollWithBacktracking(page, profile = USER_PROFILES['Average Joe']) {
  if (!isPageOpen(page)) return;
  try {
    // Get total scroll height
    const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    const timeMultiplier = getTimeBasedMultiplier();
    
    let currentScroll = 0;
    const targetScroll = scrollHeight - viewportHeight;
    
    // First, scroll down with pauses
    while (currentScroll < targetScroll * 0.8) {
      if (!isPageOpen(page)) return;
      // Scroll a random amount
      const scrollAmount = (200 + Math.random() * 400) / profile.scrollSpeed;
      currentScroll = Math.min(currentScroll + scrollAmount, targetScroll);
      
      // Smooth scroll
      await page.evaluate(({ target, duration }) => {
        return new Promise(resolve => {
          const start = window.scrollY;
          const startTime = performance.now();
          
          const animateScroll = () => {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeOut = 1 - Math.pow(1 - progress, 3);
            
            window.scrollTo({
              top: start + (target - start) * easeOut,
              left: 0
            });
            
            if (progress < 1) {
              requestAnimationFrame(animateScroll);
            } else {
              resolve();
            }
          };
          
          animateScroll();
        });
      }, { target: currentScroll, duration: (300 + Math.random() * 500) * profile.scrollSpeed });
      
      // Pause to "read"
      await new Promise(r => setTimeout(r, (1000 + Math.random() * 3000) * profile.pauseMultiplier * timeMultiplier));
      
      // 30% chance to scroll back a bit
      if (Math.random() < 0.3) {
        if (!isPageOpen(page)) return;
        const backScrollAmount = 100 + Math.random() * 200;
        const backScrollTarget = Math.max(0, currentScroll - backScrollAmount);
        
        await page.evaluate(({ target, duration }) => {
          return new Promise(resolve => {
            const start = window.scrollY;
            const startTime = performance.now();
            
            const animateScroll = () => {
              const elapsed = performance.now() - startTime;
              const progress = Math.min(elapsed / duration, 1);
              const easeOut = 1 - Math.pow(1 - progress, 3);
              
              window.scrollTo({
                top: start + (target - start) * easeOut,
                left: 0
              });
              
              if (progress < 1) {
                requestAnimationFrame(animateScroll);
              } else {
                resolve();
              }
            };
            
            animateScroll();
          });
        }, { target: backScrollTarget, duration: (200 + Math.random() * 300) * profile.scrollSpeed });
        
        // Pause to "re-read"
        await new Promise(r => setTimeout(r, (800 + Math.random() * 2000) * profile.pauseMultiplier * timeMultiplier));
        
        if (!isPageOpen(page)) return;
        // Scroll back to previous position
        await page.evaluate(({ target, duration }) => {
          return new Promise(resolve => {
            const start = window.scrollY;
            const startTime = performance.now();
            
            const animateScroll = () => {
              const elapsed = performance.now() - startTime;
              const progress = Math.min(elapsed / duration, 1);
              const easeOut = 1 - Math.pow(1 - progress, 3);
              
              window.scrollTo({
                top: start + (target - start) * easeOut,
                left: 0
              });
              
              if (progress < 1) {
                requestAnimationFrame(animateScroll);
              } else {
                resolve();
              }
            };
            
            animateScroll();
          });
        }, { target: currentScroll, duration: (200 + Math.random() * 300) * profile.scrollSpeed });
        
        await new Promise(r => setTimeout(r, (500 + Math.random() * 1500) * profile.pauseMultiplier * timeMultiplier));
      }
    }
  } catch (error) {
    console.error('Error in scrollWithBacktracking:', error);
  }
}

// Helper: Handle 429/503 errors with exponential backoff and Retry-After header support
async function handleRateLimitError(error, attempt) {
  // Default values
  let waitTime = 5 * 1000; // 5 seconds initial
  const maxWaitTime = 5 * 60 * 1000; // 5 minutes max
  const jitter = Math.random() * 0.3 + 0.85; // ±15% jitter to avoid thundering herd
  
  // Check for Retry-After header if available
  if (error.response && error.response.headers && error.response.headers['retry-after']) {
    const retryAfter = error.response.headers['retry-after'];
    const retryAfterSeconds = parseInt(retryAfter, 10);
    if (!isNaN(retryAfterSeconds) && retryAfterSeconds > 0) {
      waitTime = Math.min(retryAfterSeconds * 1000, maxWaitTime);
      console.log(`[Rate Limit] Respecting Retry-After header: ${retryAfterSeconds} seconds`);
    }
  }
  
  // Exponential backoff: 5s, 10s, 20s, 40s, etc.
  waitTime = Math.min(waitTime * Math.pow(2, attempt), maxWaitTime) * jitter;
  console.log(`[Rate Limit] Got 429/503, waiting ${(waitTime / 1000).toFixed(1)} seconds before retry ${attempt + 1}...`);
  
  await new Promise(resolve => setTimeout(resolve, waitTime));
}

async function performSearchMode(page, targetUrl, searchEngine, keywords, platform, targetName, pageNumber = 1, sort = 'Relevance') {
  if (platform) {
    return performFreelancingSearchMode(page, targetUrl, searchEngine, keywords, platform, targetName, pageNumber, sort);
  }

  const maxRetries = 3;
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      // Get search engine config
      const engine = SEARCH_ENGINES[searchEngine] || SEARCH_ENGINES['Google'];
      
      // Parse target URL for flexible matching
      const parsedTarget = new URL(targetUrl);
      const targetDomain = parsedTarget.hostname.toLowerCase();
      const targetPath = parsedTarget.pathname.toLowerCase();
      
      // Extract special IDs (like Instagram reels, TikTok videos, etc.)
      let specialId = null;
      if (targetPath.includes('/reel/')) {
        specialId = targetPath.split('/reel/')[1].split('/')[0];
      } else if (targetPath.includes('/video/')) {
        specialId = targetPath.split('/video/')[1].split('/')[0];
      } else if (targetPath.includes('/watch')) {
        specialId = parsedTarget.searchParams.get('v');
      }
      
      // Navigate to search engine
      if (!isPageOpen(page)) throw new Error('Page closed before search engine navigation');
      await page.goto(engine.url, { waitUntil: 'networkidle', timeout: 30000 });
      await new Promise(r => setTimeout(r, 500 + Math.random() * 1000));
      
      // Find search input
      if (!isPageOpen(page)) throw new Error('Page closed before search input');
      await page.waitForSelector(engine.searchInputSelector, { timeout: 10000 });
      
      // Hover over search input before clicking
      await hoverBeforeClick(page, engine.searchInputSelector);
      await new Promise(r => setTimeout(r, 200 + Math.random() * 400));
      
      // Type keywords with human-like behavior (typos, corrections, pauses)
      const searchInput = await page.$(engine.searchInputSelector);
      if (!isPageOpen(page) || !searchInput) throw new Error('Search input not available');
      await typeWithHumanLikeBehavior(page, searchInput, keywords);
      
      // Submit search (either press Enter or click button)
      await searchInput.press('Enter');
      
      // Wait for results
      if (!isPageOpen(page)) throw new Error('Page closed before results load');
      await page.waitForLoadState('networkidle', { timeout: 30000 });
      await new Promise(r => setTimeout(r, 1000 + Math.random() * 1500));
      
      // Scroll through results with backtracking
      await scrollWithBacktracking(page);
      
      // Look for target URL in results with flexible matching
      let foundLink = null;
      const allLinks = await page.$$eval('a[href]', anchors => 
        anchors.map(a => ({ href: a.href }))
      );
      
      for (const linkData of allLinks) {
        const href = linkData.href.toLowerCase();
        
        // Match rules
        if (href.includes(targetUrl.toLowerCase())) { // Exact URL match
          foundLink = linkData.href;
          break;
        } else if (href.includes(targetDomain) && targetPath && href.includes(targetPath)) { // Domain + path match
          foundLink = linkData.href;
          break;
        } else if (href.includes(targetDomain) && specialId && href.includes(specialId)) { // Domain + special ID
          foundLink = linkData.href;
          break;
        }
      }
      
      // If found, navigate to the found link (not just targetUrl directly)
      const finalUrl = foundLink || targetUrl;
      if (foundLink) {
        console.log(`[Search Mode] Found matching link: ${foundLink}`);
      } else {
        console.log(`[Search Mode] No matching link found, navigating directly to: ${targetUrl}`);
      }
      
      await new Promise(r => setTimeout(r, 500 + Math.random() * 1000));
      await page.goto(finalUrl, { waitUntil: 'networkidle', timeout: 30000 });
      
      return true;
    } catch (error) {
      console.error(`[Search Mode] Error on attempt ${attempt + 1}:`, error);
      
      // Check if this is a rate limiting error (429 or 503)
      const isRateLimitError = 
        (error.message && (error.message.includes('429') || error.message.includes('503'))) ||
        (error.response && (error.response.status === 429 || error.response.status === 503));
      
      if (isRateLimitError && attempt < maxRetries - 1) {
        await handleRateLimitError(error, attempt);
        attempt++;
        continue;
      } else {
        // For non-rate-limit errors, or final attempt, try direct navigation as fallback
        console.log(`[Search Mode] Falling back to direct navigation`);
        try {
          await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 });
          return true;
        } catch (fallbackError) {
          console.error(`[Search Mode] Fallback navigation also failed:`, fallbackError);
          throw fallbackError;
        }
      }
    }
  }
  throw new Error('[Search Mode] Max retries exceeded');
}

// Dialog IPC handler
ipcMain.handle('dialog:open-file', async (event, options) => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog(options || {});
    return { canceled, filePaths };
  } catch (error) {
    console.error('Error opening file dialog:', error);
    throw error;
  }
});

// Playwright IPC handlers
ipcMain.handle('browser:open', async (event, { url, slotId, deviceType = 'Desktop Chrome', mode = 'direct', searchEngine, searchKeywords, searchPlatform, searchTargetName, searchPage, searchSort, networkThrottle = 'none', proxy, userAgent, headless = true }) => {
  try {
    // Clean up existing browser for this slot if any
    if (activeBrowsers.has(slotId)) {
        const existing = activeBrowsers.get(slotId);
        try {
          await closeBrowserWithTimeout(slotId, existing.browser, existing.context, 3000);
          activeBrowsers.delete(slotId);
        } catch (e) {
          console.error('Error closing existing browser for slot', slotId, e);
        }

    }
    // Enforce max concurrency for browsers to reduce memory/CPU usage
    if (activeBrowsers.size >= MAX_CONCURRENT_BROWSERS) {
      try {
        console.log(`[browser:open] Waiting for available slot (active=${activeBrowsers.size})`);
        await waitForBrowserSlot(30000);
      } catch (e) {
        console.error('[browser:open] No available browser slots:', e.message);
        return { success: false, error: 'No available browser slots' };
      }
    }

    // Get device preset
    
    const device = DEVICE_PRESETS[deviceType] || DEVICE_PRESETS['Desktop Chrome'];

    // Build launch options with proxy if provided
    const launchOptions = {
      headless: headless,
      args: [
        '--no-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--window-position=0,0',
        '--window-size=1920,1080'
      ]
    };

    if (proxy) {
      const proxyServer = `${proxy.type}://${proxy.host}:${proxy.port}`;
      launchOptions.proxy = { server: proxyServer };
      if (proxy.username && proxy.password) {
        // Add credentials to proxy server URL
        launchOptions.proxy.server = `${proxy.type}://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`;
      }
    }

    // Launch a new Chromium browser, fallback to system edge/chrome if bundled chromium is missing (common in electron-builder)
    let browser;
    try {
      browser = await chromium.launch(launchOptions);
    } catch (e) {
      console.log('[browser:open] Default chromium launch failed, trying msedge...', e.message);
      try {
        launchOptions.channel = 'msedge';
        browser = await chromium.launch(launchOptions);
      } catch (e2) {
        console.log('[browser:open] msedge launch failed, trying chrome...', e2.message);
        launchOptions.channel = 'chrome';
        browser = await chromium.launch(launchOptions);
      }
    }

    const contextOptions = {
      viewport: device.viewport,
      userAgent: userAgent || device.userAgent,
      hasTouch: device.hasTouch,
      isMobile: device.isMobile,
      locale: proxy?.language || 'en-US',
      timezoneId: proxy?.timezone || 'America/New_York'
    };

    const context = await browser.newContext(contextOptions);

    // Load saved cookies for this slot
    await loadCookies(slotId, context);

    const throttlePreset = NETWORK_PRESETS[networkThrottle];
    const page = await context.newPage();

    // Apply network throttling if needed
    if (throttlePreset) {
      try {
        const cdpSession = await context.newCDPSession(page);
        await cdpSession.send('Network.emulateNetworkConditions', {
          offline: false,
          downloadThroughput: throttlePreset.download,
          uploadThroughput: throttlePreset.upload,
          latency: throttlePreset.latency,
        });
      } catch (e) {
        console.error('Failed to apply network throttle to page:', e);
      }

      // We need to apply throttling to all pages, so attach to future page creation
      context.on('page', async (newPage) => {
        try {
          const pageCdp = await context.newCDPSession(newPage);
          await pageCdp.send('Network.emulateNetworkConditions', {
            offline: false,
            downloadThroughput: throttlePreset.download,
            uploadThroughput: throttlePreset.upload,
            latency: throttlePreset.latency,
          });
        } catch (e) {
          console.error('Failed to apply network throttle to new page:', e);
        }
      });
    }

    // Disable webdriver flag for all pages in this context
    await context.addInitScript(() => {
      try {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });
      } catch (e) {
        // ignore
      }
    });

    // Disable WebRTC to prevent IP leaks from browser pages
    await context.addInitScript(() => {
      try {
        const noop = () => Promise.reject(new Error('WebRTC disabled'));
        if (window.RTCPeerConnection) window.RTCPeerConnection = undefined;
        if (window.webkitRTCPeerConnection) window.webkitRTCPeerConnection = undefined;
        if (window.mozRTCPeerConnection) window.mozRTCPeerConnection = undefined;
        if (navigator.mediaDevices) {
          navigator.mediaDevices.getUserMedia = noop;
          navigator.mediaDevices.enumerateDevices = () => Promise.resolve([]);
        }
        if (navigator.getUserMedia) navigator.getUserMedia = noop;
        if (navigator.webkitGetUserMedia) navigator.webkitGetUserMedia = noop;
        if (navigator.mozGetUserMedia) navigator.mozGetUserMedia = noop;
      } catch (e) {
        // ignore
      }
    });

    // Navigate based on mode
    if ((mode === 'search' || mode === 'freelancing') && searchEngine && searchKeywords) {
      await performSearchMode(page, url, searchEngine, searchKeywords, searchPlatform, searchTargetName, searchPage, searchSort);
    } else {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    }

    // Store metadata for management
    activeBrowsers.set(slotId, { 
      browser, 
      page, 
      context, 
      url: url, 
      headless: !!headless,
      proxyId: proxy?.id || null,
      accountName: null
    });
    
    // Track proxy usage
    if (proxy?.id) {
      proxyRotationManager.trackSlotProxy(slotId, proxy.id);
    }

    // After navigation: try to auto-click consent dialogs and detect challenges
    (async () => {
      try {
        await autoHandleConsentAndChallenges(slotId, page);
      } catch (e) {
        console.error('Auto-handle consent failed for slot', slotId, e);
      }
    })();

    return { success: true };
  } catch (error) {
    console.error('Failed to open browser:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('browser:close', async (event, { slotId }) => {
  try {
    if (activeBrowsers.has(slotId)) {
      const { browser, context, proxyId } = activeBrowsers.get(slotId);
      
      // Release proxy tracking
      if (proxyId) {
        proxyRotationManager.releaseSlotProxy(slotId);
      }
      
      await closeBrowserWithTimeout(slotId, browser, context, 3000);
      activeBrowsers.delete(slotId);
    }
    return { success: true };
  } catch (error) {
    console.error('Failed to close browser:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('browser:wait', async (event, { slotId, durationMs }) => {
  try {
    if (activeBrowsers.has(slotId)) {
      const { page } = activeBrowsers.get(slotId);
      
      // Simulate human behavior
      await Promise.all([
        simulateHumanMovement(page, durationMs),
        navigateInternalLinks(page)
      ]);
    }
    return { success: true };
  } catch (error) {
    console.error('Failed to wait:', error);
    return { success: false, error: error.message };
  }
});

// Get list of available devices
ipcMain.handle('browser:getDevices', async () => {
  return Object.keys(DEVICE_PRESETS);
});

// Get proxy rotation stats
ipcMain.handle('browser:getProxyStats', async () => {
  return proxyRotationManager.getStats();
});

// Close all browsers
ipcMain.handle('browser:closeAll', async () => {
  try {
    await closeAllBrowsers();
    return { success: true };
  } catch (error) {
    console.error('Failed to close all browsers:', error);
    return { success: false, error: error.message };
  }
});

// 2Captcha API handlers
ipcMain.handle('captcha:set2CaptchaKey', async (event, apiKey) => {
  try {
    captchaSolver.setApiKey(apiKey);
    
    // Save to config file for persistence
    const configPath = path.join(app.getPath('userData'), '2captcha-config.json');
    fs.writeFileSync(configPath, JSON.stringify({ apiKey }, null, 2));
    
    console.log('[2Captcha] API key saved and configured');
    return { success: true };
  } catch (error) {
    console.error('Failed to set 2Captcha key:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('captcha:get2CaptchaKey', async (event) => {
  // Return masked key for security (don't expose full key)
  if (captchaSolver.API_KEY) {
    const masked = captchaSolver.API_KEY.substring(0, 5) + '...' + captchaSolver.API_KEY.substring(captchaSolver.API_KEY.length - 3);
    return { hasKey: true, masked };
  }
  return { hasKey: false };
});

ipcMain.handle('captcha:is2CaptchaConfigured', async (event) => {
  return { configured: !!captchaSolver.API_KEY };
});

// Recreate a browser instance for a slot with a different headless flag (used to hide/show)
const recreateBrowserWithHeadless = async (slotId, entry, newHeadless) => {
  try {
    const { browser, context, url } = entry;
    // Save cookies
    await saveCookies(slotId, context);
  } catch (e) {
    console.error('Error saving cookies during recreate:', e);
  }

  // Close old browser (with timeout)
  try { await closeBrowserWithTimeout(slotId, entry.browser, entry.context, 3000); } catch (e) { /* ignore */ }

  // Relaunch with same options but changed headless
  try {
    const launchOptions = {
      headless: !!newHeadless,
      args: ['--no-sandbox', '--disable-blink-features=AutomationControlled', '--window-position=0,0', '--window-size=1920,1080']
    };
    const newBrowser = await chromium.launch(launchOptions);
    const newContext = await newBrowser.newContext({
      viewport: entry.context._options?.viewport || { width: 1920, height: 1080 },
      userAgent: entry.context._options?.userAgent || undefined,
      locale: entry.context._options?.locale || 'en-US',
    });
    const newPage = await newContext.newPage();
    if (entry.url) {
      try { await newPage.goto(entry.url, { waitUntil: 'networkidle', timeout: 30000 }); } catch (e) { /* ignore */ }
    }
    activeBrowsers.set(slotId, { browser: newBrowser, context: newContext, page: newPage, url: entry.url, headless: !!newHeadless });
    // Try to auto-handle consent
    try { await autoHandleConsentAndChallenges(slotId, newPage); } catch (e) { /* ignore */ }
  } catch (e) {
    console.error('Failed to recreate browser for slot', slotId, e);
  }
};

// IPC to set hidden state for all active browsers (recreate headless/headful as needed)
ipcMain.handle('browser:setHidden', async (event, { hidden }) => {
  try {
    const tasks = [];
    for (const [slotId, entry] of activeBrowsers.entries()) {
      const currentlyHeadless = !!entry.headless;
      if (hidden && !currentlyHeadless) {
        tasks.push(recreateBrowserWithHeadless(slotId, entry, true));
      } else if (!hidden && currentlyHeadless) {
        tasks.push(recreateBrowserWithHeadless(slotId, entry, false));
      }
    }
    await Promise.all(tasks);
    return { success: true };
  } catch (e) {
    console.error('Failed to set hidden state for browsers:', e);
    return { success: false, error: e.message };
  }
});

// Notification handlers
ipcMain.handle('notifications:get', async (event, userId) => {
  try {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC');
    return stmt.all(userId);
  } catch (error) {
    console.error('Error getting notifications:', error);
    throw error;
  }
});

ipcMain.handle('notifications:create', async (event, { userId, type, title, message }) => {
  try {
    const db = getDb();
    const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const stmt = db.prepare('INSERT INTO notifications (id, user_id, type, title, message, read) VALUES (?, ?, ?, ?, ?, ?)');
    stmt.run(id, userId, type, title, message, 0);
    return { id, userId, type, title, message, read: false, createdAt: new Date().toISOString() };
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
});

ipcMain.handle('notifications:markRead', async (event, notificationId) => {
  try {
    const db = getDb();
    const stmt = db.prepare('UPDATE notifications SET read = 1 WHERE id = ?');
    stmt.run(notificationId);
    return { success: true };
  } catch (error) {
    console.error('Error marking notification read:', error);
    throw error;
  }
});

ipcMain.handle('notifications:delete', async (event, notificationId) => {
  try {
    const db = getDb();
    const stmt = db.prepare('DELETE FROM notifications WHERE id = ?');
    stmt.run(notificationId);
    return { success: true };
  } catch (error) {
    console.error('Error deleting notification:', error);
    throw error;
  }
});

// Contacts handlers
ipcMain.handle('contacts:get', async (event, userId) => {
  try {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM contacts WHERE user_id = ? ORDER BY created_at DESC');
    return stmt.all(userId);
  } catch (error) {
    console.error('Error getting contacts:', error);
    throw error;
  }
});

ipcMain.handle('contacts:create', async (event, { userId, name, email, phone, notes }) => {
  try {
    const db = getDb();
    const id = `contact-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const stmt = db.prepare('INSERT INTO contacts (id, user_id, name, email, phone, notes) VALUES (?, ?, ?, ?, ?, ?)');
    stmt.run(id, userId, name, email, phone, notes);
    return { id, userId, name, email, phone, notes, createdAt: new Date().toISOString() };
  } catch (error) {
    console.error('Error creating contact:', error);
    throw error;
  }
});

ipcMain.handle('contacts:update', async (event, contactId, patch) => {
  try {
    const db = getDb();
    const updates = [];
    const params = [];
    if (patch.name !== undefined) { updates.push('name = ?'); params.push(patch.name); }
    if (patch.email !== undefined) { updates.push('email = ?'); params.push(patch.email); }
    if (patch.phone !== undefined) { updates.push('phone = ?'); params.push(patch.phone); }
    if (patch.notes !== undefined) { updates.push('notes = ?'); params.push(patch.notes); }

    params.push(contactId);
    const stmt = db.prepare(`UPDATE contacts SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(...params);
    return { success: true };
  } catch (error) {
    console.error('Error updating contact:', error);
    throw error;
  }
});

ipcMain.handle('contacts:delete', async (event, contactId) => {
  try {
    const db = getDb();
    const stmt = db.prepare('DELETE FROM contacts WHERE id = ?');
    stmt.run(contactId);
    return { success: true };
  } catch (error) {
    console.error('Error deleting contact:', error);
    throw error;
  }
});

// Saved campaigns handlers
ipcMain.handle('savedCampaigns:get', async (event, userId) => {
  try {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM saved_campaigns WHERE user_id = ? ORDER BY created_at DESC');
    return stmt.all(userId);
  } catch (error) {
    console.error('Error getting saved campaigns:', error);
    throw error;
  }
});

ipcMain.handle('savedCampaigns:create', async (event, { userId, name, title, url, category, creditsAllocated, dailyLimit, targetCountries, mode, searchEngine, searchKeywords }) => {
  try {
    const db = getDb();
    const id = `saved-campaign-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const stmt = db.prepare(`
      INSERT INTO saved_campaigns 
      (id, user_id, name, title, url, category, credits_allocated, daily_limit, target_countries, mode, search_engine, search_keywords)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, userId, name, title, url, category, creditsAllocated, dailyLimit, targetCountries?.join(','), mode || 'direct', searchEngine, searchKeywords);
    return { id, userId, name, title, url, category, creditsAllocated, dailyLimit, targetCountries, mode: mode || 'direct', searchEngine, searchKeywords, createdAt: new Date().toISOString() };
  } catch (error) {
    console.error('Error creating saved campaign:', error);
    throw error;
  }
});

ipcMain.handle('savedCampaigns:delete', async (event, savedCampaignId) => {
  try {
    const db = getDb();
    const stmt = db.prepare('DELETE FROM saved_campaigns WHERE id = ?');
    stmt.run(savedCampaignId);
    return { success: true };
  } catch (error) {
    console.error('Error deleting saved campaign:', error);
    throw error;
  }
});

// Proxy handlers
ipcMain.handle('proxies:get', async (event, userId) => {
  try {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM proxies WHERE user_id = ? ORDER BY created_at DESC');
    return stmt.all(userId);
  } catch (error) {
    console.error('Error getting proxies:', error);
    throw error;
  }
});

ipcMain.handle('proxies:create', async (event, { userId, type, host, port, username, password, country, timezone, language }) => {
  try {
    const db = getDb();
    const id = `proxy-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const stmt = db.prepare(`
      INSERT INTO proxies 
      (id, user_id, type, host, port, username, password, country, timezone, language)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, userId, type || 'http', host, port, username, password, country, timezone, language || 'en-US');
    return { id, userId, type: type || 'http', host, port, username, password, country, timezone, language: language || 'en-US', createdAt: new Date().toISOString() };
  } catch (error) {
    console.error('Error creating proxy:', error);
    throw error;
  }
});

ipcMain.handle('proxies:update', async (event, proxyId, patch) => {
  try {
    const db = getDb();
    const updates = [];
    const params = [];
    if (patch.type !== undefined) { updates.push('type = ?'); params.push(patch.type); }
    if (patch.host !== undefined) { updates.push('host = ?'); params.push(patch.host); }
    if (patch.port !== undefined) { updates.push('port = ?'); params.push(patch.port); }
    if (patch.username !== undefined) { updates.push('username = ?'); params.push(patch.username); }
    if (patch.password !== undefined) { updates.push('password = ?'); params.push(patch.password); }
    if (patch.country !== undefined) { updates.push('country = ?'); params.push(patch.country); }
    if (patch.timezone !== undefined) { updates.push('timezone = ?'); params.push(patch.timezone); }
    if (patch.language !== undefined) { updates.push('language = ?'); params.push(patch.language); }

    params.push(proxyId);
    const stmt = db.prepare(`UPDATE proxies SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(...params);
    return { success: true };
  } catch (error) {
    console.error('Error updating proxy:', error);
    throw error;
  }
});

ipcMain.handle('proxies:delete', async (event, proxyId) => {
  try {
    const db = getDb();
    const stmt = db.prepare('DELETE FROM proxies WHERE id = ?');
    stmt.run(proxyId);
    return { success: true };
  } catch (error) {
    console.error('Error deleting proxy:', error);
    throw error;
  }
});

// Proxy import handlers
const resolveImportUserId = (userId) => {
  const db = getDb();
  const lookupId = userId && typeof userId === 'string' && userId.trim().length > 0 ? userId : 'mock-user';
  const stmt = db.prepare('SELECT 1 FROM users WHERE id = ?');
  const row = stmt.get(lookupId);
  if (row) return lookupId;

  const insertUser = db.prepare('INSERT OR IGNORE INTO users (id, name, email, phone) VALUES (?, ?, ?, ?)');
  insertUser.run(lookupId, 'Demo User', 'demo@example.com', '+1234567890');
  return lookupId;
};

ipcMain.handle('proxies:import-file', async (event, { userId, filePath }) => {
  console.log('[proxies:import-file] called with userId:', userId, 'filePath:', filePath);
  const db = getDb();
  const lookupUserId = resolveImportUserId(userId);
  console.log('[proxies:import-file] lookupUserId:', lookupUserId);
  
  if (!filePath || typeof filePath !== 'string') {
    const message = 'Invalid file path provided for proxy import';
    console.error(message, { lookupUserId, filePath });
    return { success: false, count: 0, proxies: [], error: message };
  }

  try {
    console.log('[proxies:import-file] reading file at:', filePath);
    const content = fs.readFileSync(filePath, 'utf-8');
    console.log('[proxies:import-file] file content:', content);
    
    const proxies = parseProxies(content);
    console.log('[proxies:import-file] parsed', proxies.length, 'proxies');
    const imported = [];
    
    for (const proxy of proxies) {
      console.log('[proxies:import-file] processing proxy:', proxy);
      // Skip invalid proxies
      if (!proxy.host || !proxy.port) continue;
      
      const id = `proxy-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const stmt = db.prepare(`
        INSERT INTO proxies 
        (id, user_id, type, host, port, username, password, country, timezone, language)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        id, 
        lookupUserId, 
        proxy.type || 'http', 
        proxy.host, 
        proxy.port, 
        proxy.username, 
        proxy.password, 
        proxy.country, 
        proxy.timezone, 
        proxy.language || 'en-US'
      );
      imported.push({ id, userId: lookupUserId, ...proxy, createdAt: new Date().toISOString() });
    }
    
    console.log('[proxies:import-file] imported', imported.length, 'proxies');
    return { success: true, count: imported.length, proxies: imported };
  } catch (error) {
    console.error('Error importing proxies:', { error, lookupUserId });
    return { 
      success: false, 
      count: 0, 
      proxies: [], 
      error: error?.message || 'Failed to import proxies' 
    };
  }
});

ipcMain.handle('proxies:import-content', async (event, { userId, content }) => {
  console.log('[proxies:import-content] called with userId:', userId, 'content length:', content?.length);
  const db = getDb();
  const lookupUserId = resolveImportUserId(userId);
  console.log('[proxies:import-content] lookupUserId:', lookupUserId);
  
  try {
    console.log('[proxies:import-content] content:', content);
    
    const proxies = parseProxies(content);
    console.log('[proxies:import-content] parsed', proxies.length, 'proxies');
    
    const imported = [];
    
    for (const proxy of proxies) {
      console.log('[proxies:import-content] processing proxy:', proxy);
      // Skip invalid proxies
      if (!proxy.host || !proxy.port) continue;
      
      const id = `proxy-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const stmt = db.prepare(`
        INSERT INTO proxies 
        (id, user_id, type, host, port, username, password, country, timezone, language)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        id, 
        lookupUserId, 
        proxy.type || 'http', 
        proxy.host, 
        proxy.port, 
        proxy.username, 
        proxy.password, 
        proxy.country, 
        proxy.timezone, 
        proxy.language || 'en-US'
      );
      imported.push({ id, userId: lookupUserId, ...proxy, createdAt: new Date().toISOString() });
    }
    
    console.log('[proxies:import-content] imported', imported.length, 'proxies');
    return { success: true, count: imported.length, proxies: imported };
  } catch (error) {
    console.error('Error importing proxies:', { error, lookupUserId });
    return { 
      success: false, 
      count: 0, 
      proxies: [], 
      error: error?.message || 'Failed to import proxies' 
    };
  }
});

ipcMain.handle('proxies:scrape', async (event, { userId, url }) => {
  try {
    const db = getDb();
    const proxies = await scrapeProxiesFromUrl(url);
    const imported = [];
    
    for (const proxy of proxies) {
      const id = `proxy-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const stmt = db.prepare(`
        INSERT INTO proxies 
        (id, user_id, type, host, port, username, password, country, timezone, language)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        id,
        userId,
        proxy.type || 'http',
        proxy.host,
        proxy.port,
        proxy.username,
        proxy.password,
        proxy.country,
        proxy.timezone,
        proxy.language || 'en-US'
      );
      imported.push({ id, userId, ...proxy, createdAt: new Date().toISOString() });
    }
    
    return { success: true, count: imported.length, proxies: imported };
  } catch (error) {
    console.error('Error scraping proxies:', error);
    throw error;
  }
});

ipcMain.handle('proxies:test', async (event, proxy) => {
  try {
    const result = await testProxy(proxy);
    return { success: true, result };
  } catch (error) {
    console.error('Error testing proxy:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('proxies:scrape-free', async (event, { userId, maxProxies = 50, minUptimePercent = 70, maxLatencyMs = 2000 }) => {
  console.log('[proxies:scrape-free] called');
  try {
    const db = getDb();
    const lookupUserId = resolveImportUserId(userId);
    console.log('[proxies:scrape-free] lookupUserId:', lookupUserId);

    // Fetch from ProxyScrape CDN
    console.log('[proxies:scrape-free] fetching proxies...');
    const response = await fetch('https://cdn.jsdelivr.net/gh/proxyscrape/free-proxy-list@main/proxies/all/data.json');
    if (!response.ok) {
      throw new Error('Failed to fetch proxy list');
    }
    const proxies = await response.json();
    console.log('[proxies:scrape-free] fetched', proxies.length, 'proxies');

    // Filter by quality
    const filtered = proxies.filter(p => 
      p.uptime_percent >= minUptimePercent && p.latency_ms <= maxLatencyMs).slice(0, maxProxies);
    console.log('[proxies:scrape-free] filtered to', filtered.length, 'proxies after quality filters');

    // Test each proxy and import working ones
    const imported = [];
    for (const p of filtered) {
      try {
        const candidate = { type: p.protocol, host: p.ip, port: p.port, country: p.country_code?.toUpperCase() || null };
        console.log('[proxies:scrape-free] testing candidate:', candidate);
        const testResult = await testProxy(candidate);
        if (testResult.alive) {
          const id = `proxy-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          const stmt = db.prepare(`
            INSERT INTO proxies 
            (id, user_id, type, host, port, username, password, country, timezone, language)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          stmt.run(id, lookupUserId, p.protocol, p.ip, p.port, '', '', p.country_code?.toUpperCase() || null, null, 'en-US');
          imported.push({ id, userId: lookupUserId, type: p.protocol, host: p.ip, port: p.port, country: p.country_code?.toUpperCase(), createdAt: new Date().toISOString() });
          console.log('[proxies:scrape-free] imported proxy:', id);
        }
      } catch (e) {
        console.log('[proxies:scrape-free] skipping failed proxy:', p.ip, p.port, e.message);
      }
    }

    console.log('[proxies:scrape-free] done, imported', imported.length, 'proxies');
    return { success: true, count: imported.length, proxies: imported };
  } catch (error) {
    console.error('[proxies:scrape-free] error:', error);
    return { success: false, error: error.message };
  }
});
