const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let db = null;

const initDatabase = (app) => {
  let userDataPath;

  if (app.isPackaged) {
    // Production: always write to OS user data directory (writable, not inside ASAR)
    // Windows: C:\Users\<user>\AppData\Roaming\TrafficPlus
    // macOS:   ~/Library/Application Support/TrafficPlus
    // Linux:   ~/.config/TrafficPlus
    userDataPath = app.getPath('userData');
    if (!fs.existsSync(userDataPath)) {
      try {
        fs.mkdirSync(userDataPath, { recursive: true });
      } catch (e) {
        console.error('Failed to create userData directory:', e);
        userDataPath = require('os').tmpdir();
      }
    }
  } else {
    // Development: use local data/ folder next to project root for easy inspection
    const localPath = path.join(__dirname, '..', 'data');
    try {
      if (!fs.existsSync(localPath)) {
        fs.mkdirSync(localPath, { recursive: true });
      }
      userDataPath = localPath;
    } catch (e) {
      console.error('Failed to create local data directory:', e);
      userDataPath = app.getPath('userData');
    }
  }

  const dbPath = path.join(userDataPath, 'traffic-plus.db');
  console.log('Database path:', dbPath);

  try {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    console.log('Database opened successfully');
    initDB();
  } catch (e) {
    console.error('Failed to open database:', e);
    throw e;
  }
};

const getDb = () => db;

const initDB = () => {
  // First, add new columns to users table if they don't exist
  try {
    db.prepare('ALTER TABLE users ADD COLUMN avatar TEXT').run();
  } catch (e) {
    // Column already exists
  }
  try {
    db.prepare('ALTER TABLE users ADD COLUMN bio TEXT').run();
  } catch (e) {
    // Column already exists
  }
  try {
    db.prepare('ALTER TABLE users ADD COLUMN store_raw_ips INTEGER DEFAULT 0').run();
  } catch (e) {
    // Column already exists
  }
  try {
    db.prepare('ALTER TABLE users ADD COLUMN last_login_at TEXT').run();
  } catch (e) {
    // Column already exists
  }
  try {
    db.prepare('ALTER TABLE users ADD COLUMN last_login_ip TEXT').run();
  } catch (e) {
    // Column already exists
  }
  try {
    db.prepare('ALTER TABLE users ADD COLUMN last_device TEXT').run();
  } catch (e) {
    // Column already exists
  }
  try {
    db.prepare('ALTER TABLE users ADD COLUMN last_location TEXT').run();
  } catch (e) {
    // Column already exists
  }
  try {
    db.prepare('ALTER TABLE users ADD COLUMN last_user_agent TEXT').run();
  } catch (e) {
    // Column already exists
  }
  try {
    db.prepare('ALTER TABLE users ADD COLUMN last_country TEXT').run();
  } catch (e) {
    // Column already exists
  }
  try {
    db.prepare('ALTER TABLE users ADD COLUMN last_region TEXT').run();
  } catch (e) {
    // Column already exists
  }
  try {
    db.prepare('ALTER TABLE users ADD COLUMN last_city TEXT').run();
  } catch (e) {
    // Column already exists
  }
  
  // Add new columns to campaigns table if they don't exist
  try {
    db.prepare('ALTER TABLE campaigns ADD COLUMN mode TEXT DEFAULT "direct"').run();
  } catch (e) {
    // Column already exists
  }
  try {
    db.prepare('ALTER TABLE campaigns ADD COLUMN search_engine TEXT').run();
  } catch (e) {
    // Column already exists
  }
  try {
    db.prepare('ALTER TABLE campaigns ADD COLUMN search_keywords TEXT').run();
  } catch (e) {
    // Column already exists
  }
  try {
    db.prepare('ALTER TABLE campaigns ADD COLUMN search_platform TEXT').run();
  } catch (e) {
    // Column already exists
  }
  try {
    db.prepare('ALTER TABLE campaigns ADD COLUMN search_target_name TEXT').run();
  } catch (e) {
    // Column already exists
  }
  try {
    db.prepare('ALTER TABLE campaigns ADD COLUMN search_page INTEGER').run();
  } catch (e) {
    // Column already exists
  }
  try {
    db.prepare('ALTER TABLE campaigns ADD COLUMN search_sort TEXT').run();
  } catch (e) {
    // Column already exists
  }
  try {
    db.prepare('ALTER TABLE campaigns ADD COLUMN search_gig_title TEXT').run();
  } catch (e) {
    // Column already exists
  }
  try {
    db.prepare('ALTER TABLE site_settings ADD COLUMN feature_pages TEXT').run();
  } catch (e) {
    // Column already exists
  }
  
  // Add new columns to saved_campaigns table if they don't exist
  try {
    db.prepare('ALTER TABLE saved_campaigns ADD COLUMN mode TEXT DEFAULT "direct"').run();
  } catch (e) {
    // Column already exists
  }
  try {
    db.prepare('ALTER TABLE saved_campaigns ADD COLUMN search_engine TEXT').run();
  } catch (e) {
    // Column already exists
  }
  try {
    db.prepare('ALTER TABLE saved_campaigns ADD COLUMN search_keywords TEXT').run();
  } catch (e) {
    // Column already exists
  }
  try {
    db.prepare('ALTER TABLE saved_campaigns ADD COLUMN search_platform TEXT').run();
  } catch (e) {
    // Column already exists
  }
  try {
    db.prepare('ALTER TABLE saved_campaigns ADD COLUMN search_target_name TEXT').run();
  } catch (e) {
    // Column already exists
  }
  try {
    db.prepare('ALTER TABLE saved_campaigns ADD COLUMN search_page INTEGER').run();
  } catch (e) {
    // Column already exists
  }
  try {
    db.prepare('ALTER TABLE saved_campaigns ADD COLUMN search_sort TEXT').run();
  } catch (e) {
    // Column already exists
  }
  try {
    db.prepare('ALTER TABLE saved_campaigns ADD COLUMN search_gig_title TEXT').run();
  } catch (e) {
    // Column already exists
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      role TEXT DEFAULT 'user',
      credits INTEGER DEFAULT 250,
      avatar TEXT,
      bio TEXT,
      store_raw_ips INTEGER DEFAULT 0,
      last_login_at TEXT,
      last_login_ip TEXT,
      last_device TEXT,
      last_location TEXT,
      last_user_agent TEXT,
      last_country TEXT,
      last_region TEXT,
      last_city TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_login_history (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      last_login_at TEXT,
      last_login_ip TEXT,
      last_device TEXT,
      last_location TEXT,
      last_user_agent TEXT,
      last_country TEXT,
      last_region TEXT,
      last_city TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      category TEXT,
      status TEXT DEFAULT 'active',
      credits_allocated INTEGER DEFAULT 100,
      credits_used INTEGER DEFAULT 0,
      daily_limit INTEGER DEFAULT 100,
      target_countries TEXT,
      target_devices TEXT DEFAULT 'desktop,mobile',
      visits_received INTEGER DEFAULT 0,
      mode TEXT DEFAULT 'direct',
      search_engine TEXT,
      search_keywords TEXT,
      search_platform TEXT,
      search_target_name TEXT,
      search_page INTEGER,
      search_sort TEXT,
      search_gig_title TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      description TEXT,
      campaign_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
    );

    CREATE TABLE IF NOT EXISTS referrals (
      id TEXT PRIMARY KEY,
      referrer_id TEXT NOT NULL,
      referred_email TEXT,
      referred_phone TEXT,
      status TEXT DEFAULT 'active',
      earnings INTEGER DEFAULT 0,
      joined_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (referrer_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT,
      read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS saved_campaigns (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      category TEXT,
      credits_allocated INTEGER DEFAULT 100,
      daily_limit INTEGER DEFAULT 100,
      target_countries TEXT,
      mode TEXT DEFAULT 'direct',
      search_engine TEXT,
      search_keywords TEXT,
      search_platform TEXT,
      search_target_name TEXT,
      search_page INTEGER,
      search_sort TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS proxies (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'http',
      host TEXT NOT NULL,
      port INTEGER NOT NULL,
      username TEXT,
      password TEXT,
      country TEXT,
      timezone TEXT,
      language TEXT DEFAULT 'en-US',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS visitors (
      id TEXT PRIMARY KEY,
      campaign_id TEXT,
      ip TEXT,
      ip_hash TEXT,
      country TEXT,
      region TEXT,
      city TEXT,
      latitude REAL,
      longitude REAL,
      user_agent TEXT,
      browser TEXT,
      os TEXT,
      device_type TEXT,
      referrer TEXT,
      session_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
    );

    CREATE TABLE IF NOT EXISTS site_settings (
      id TEXT PRIMARY KEY,
      site_name TEXT NOT NULL DEFAULT 'TrafficPlus',
      site_description TEXT,
      site_logo TEXT,
      hero_title TEXT,
      hero_subtitle TEXT,
      hero_button_text TEXT,
      hero_secondary_button_text TEXT,
      footer_text TEXT,
      copyright_text TEXT,
      primary_color TEXT,
      secondary_color TEXT,
      auth_required INTEGER NOT NULL DEFAULT 0,
      features TEXT,
      testimonials TEXT,
      feature_pages TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const ensureUserStmt = db.prepare('SELECT 1 FROM users WHERE id = ?');
  const ensureUser = (id) => ensureUserStmt.get(id);
  const insertUser = db.prepare('INSERT INTO users (id, name, email, phone) VALUES (?, ?, ?, ?)');
  if (!ensureUser('mock-user')) {
    insertUser.run('mock-user', 'Demo User', 'demo@example.com', '+1234567890');
  }

  const demoOwners = [
    { id: 'demo-owner-1', name: 'Demo Marketer A', email: 'owner1@example.com' },
    { id: 'demo-owner-2', name: 'Demo Marketer B', email: 'owner2@example.com' },
  ];

  for (const owner of demoOwners) {
    if (!ensureUser(owner.id)) {
      insertUser.run(owner.id, owner.name, owner.email, '');
    }
  }

  const campaignExists = (id) => db.prepare('SELECT 1 FROM campaigns WHERE id = ?').get(id);
  const insertCampaign = db.prepare(`
      INSERT INTO campaigns 
      (id, owner_id, title, url, category, status, credits_allocated, credits_used, daily_limit, target_countries, target_devices, visits_received, mode, search_engine, search_keywords)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const seedCampaigns = [
    {
      id: 'search-wikipedia',
      ownerId: 'demo-owner-1',
      title: 'Wikipedia Search',
      url: 'https://wikipedia.org',
      category: 'education',
      creditsAllocated: 300,
      creditsUsed: 0,
      dailyLimit: 120,
      targetCountries: 'US,CA,GB',
      visitsReceived: 0,
      mode: 'search',
      search_engine: 'Google',
      search_keywords: 'Wikipedia free encyclopedia',
    },
    {
      id: 'search-github',
      title: 'GitHub Search',
      url: 'https://github.com',
      category: 'tech',
      creditsAllocated: 300,
      creditsUsed: 5,
      dailyLimit: 120,
      targetCountries: 'US,GB,DE',
      visitsReceived: 18,
      mode: 'search',
      search_engine: 'Google',
      search_keywords: 'GitHub open source',
    },
    {
      id: 'search-techcrunch',
      title: 'TechCrunch Search',
      url: 'https://techcrunch.com',
      category: 'news',
      creditsAllocated: 250,
      creditsUsed: 40,
      dailyLimit: 100,
      targetCountries: 'US,GB,CA',
      visitsReceived: 40,
      mode: 'search',
      search_engine: 'DuckDuckGo',
      search_keywords: 'TechCrunch startup news',
    },
    {
      id: 'search-stackoverflow',
      title: 'Stack Overflow Search',
      url: 'https://stackoverflow.com',
      category: 'development',
      creditsAllocated: 250,
      creditsUsed: 30,
      dailyLimit: 100,
      targetCountries: 'US,IN,UK',
      visitsReceived: 30,
      mode: 'search',
      search_engine: 'Google',
      search_keywords: 'Stack Overflow programming help',
    },
    {
      id: 'search-hackernews',
      title: 'Hacker News Search',
      url: 'https://news.ycombinator.com',
      category: 'startup',
      creditsAllocated: 250,
      creditsUsed: 20,
      dailyLimit: 90,
      targetCountries: 'US,CA,GB',
      visitsReceived: 24,
      mode: 'search',
      search_engine: 'Google',
      search_keywords: 'Hacker News Y Combinator',
    },
    {
      id: 'search-bbc',
      title: 'BBC Search',
      url: 'https://bbc.com',
      category: 'news',
      creditsAllocated: 200,
      creditsUsed: 10,
      dailyLimit: 80,
      targetCountries: 'GB,US,AU',
      visitsReceived: 14,
      mode: 'search',
      search_engine: 'DuckDuckGo',
      search_keywords: 'BBC News world',
    },
    {
      id: 'search-cnn',
      title: 'CNN Search',
      url: 'https://cnn.com',
      category: 'news',
      creditsAllocated: 200,
      creditsUsed: 15,
      dailyLimit: 80,
      targetCountries: 'US,CA,GB',
      visitsReceived: 16,
      mode: 'search',
      search_engine: 'Google',
      search_keywords: 'CNN breaking news',
    },
    {
      id: 'search-nytimes',
      title: 'New York Times Search',
      url: 'https://nytimes.com',
      category: 'news',
      creditsAllocated: 200,
      creditsUsed: 14,
      dailyLimit: 80,
      targetCountries: 'US,CA,GB',
      visitsReceived: 18,
      mode: 'search',
      search_engine: 'DuckDuckGo',
      search_keywords: 'NYTimes news',
    },
    {
      id: 'search-amazon',
      title: 'Amazon Search',
      url: 'https://amazon.com',
      category: 'shopping',
      creditsAllocated: 300,
      creditsUsed: 22,
      dailyLimit: 110,
      targetCountries: 'US,CA,GB',
      visitsReceived: 26,
      mode: 'search',
      search_engine: 'Google',
      search_keywords: 'Amazon online shopping',
    },
    {
      id: 'search-spotify',
      title: 'Spotify Search',
      url: 'https://spotify.com',
      category: 'music',
      creditsAllocated: 200,
      creditsUsed: 12,
      dailyLimit: 90,
      targetCountries: 'US,GB,SE',
      visitsReceived: 14,
      mode: 'search',
      search_engine: 'DuckDuckGo',
      search_keywords: 'Spotify music streaming',
    },
    {
      id: 'search-youtube',
      title: 'YouTube Search',
      url: 'https://youtube.com',
      category: 'video',
      creditsAllocated: 300,
      creditsUsed: 0,
      dailyLimit: 120,
      targetCountries: 'US,CA,GB',
      visitsReceived: 0,
      mode: 'search',
      search_engine: 'Google',
      search_keywords: 'YouTube videos',
    },
    {
      id: 'search-mdn',
      title: 'MDN Search',
      url: 'https://developer.mozilla.org',
      category: 'development',
      creditsAllocated: 250,
      creditsUsed: 0,
      dailyLimit: 100,
      targetCountries: 'US,GB,DE',
      visitsReceived: 0,
      mode: 'search',
      search_engine: 'Google',
      search_keywords: 'MDN Web Docs',
    },
  ];

  for (let i = 0; i < seedCampaigns.length; i++) {
    const campaign = seedCampaigns[i];
    if (!campaignExists(campaign.id)) {
      const ownerId = campaign.ownerId || (i % 2 === 0 ? 'demo-owner-1' : 'demo-owner-2');
      insertCampaign.run(
        campaign.id,
        ownerId,
        campaign.title,
        campaign.url,
        campaign.category,
        'active',
        campaign.creditsAllocated,
        campaign.creditsUsed,
        campaign.dailyLimit,
        campaign.targetCountries,
        'desktop,mobile',
        campaign.visitsReceived,
        campaign.mode || 'direct',
        campaign.search_engine,
        campaign.search_keywords
      );
    }
  }

  // Seed visitors demo data if none exists
  try {
    const vCount = db.prepare('SELECT COUNT(*) AS count FROM visitors').get();
    if (!vCount || vCount.count === 0) {
      const insertVisitor = db.prepare(`INSERT INTO visitors (id, campaign_id, ip, ip_hash, country, region, city, latitude, longitude, user_agent, browser, os, device_type, referrer, session_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      const now = new Date().toISOString();
      insertVisitor.run('v1', '1', '203.0.113.5', null, 'US', 'California', 'San Francisco', 37.7749, -122.4194, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Chrome', 'Windows', 'desktop', 'https://referrer.example', 's1', now);
      insertVisitor.run('v2', '1', '198.51.100.12', null, 'US', 'New York', 'New York', 40.7128, -74.0060, 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)', 'Safari', 'iOS', 'mobile', 'https://m.ref', 's2', now);
      insertVisitor.run('v3', '2', '192.0.2.33', null, 'GB', 'England', 'London', 51.5074, -0.1278, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 11_2)', 'Safari', 'MacOS', 'desktop', null, 's3', now);
      // Demo campaign visitors for the demo-direct and demo-search campaigns
      insertVisitor.run('v4', 'demo-direct', '198.51.100.45', null, 'US', 'California', 'Los Angeles', 34.0522, -118.2437, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Chrome', 'Windows', 'desktop', 'https://en.wikipedia.org', 'sd1', now);
      insertVisitor.run('v5', 'demo-search', '203.0.113.77', null, 'GB', 'England', 'Manchester', 53.4808, -2.2426, 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)', 'Safari', 'iOS', 'mobile', 'https://github.com', 'sd2', now);
    }
  } catch (e) {
    // ignore
  }
};

module.exports = { initDatabase, getDb };
