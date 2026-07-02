import type { Activity, Campaign, Referral, Proxy, SiteSettings, User, Notification } from "@/types";
import { supabase, isSupabaseEnabled } from "@/lib/supabase";

const electronAPI = (window as any).electronAPI;

const LOCAL_STORAGE_KEYS = {
  campaigns: 'trafficplus-campaigns',
  activities: 'trafficplus-activities',
  referrals: 'trafficplus-referrals',
  visitors: 'trafficplus-visitors',
  proxies: 'trafficplus-proxies',
};

let _userId: string | null = null;
const dispatch = () => window.dispatchEvent(new CustomEvent("data:changed"));

export function setUserId(id: string | null) {
  _userId = id;
  if (!id) {
    // Clear local activities if needed
  }
}

export function getCurrentUserId(): string | null {
  return _userId;
}

export async function loadCampaigns(): Promise<void> {
  // Loaded from DB on demand
}

export async function loadActivities(): Promise<void> {
  // Loaded from DB on demand
}

export async function loadReferrals(): Promise<void> {
  // Loaded from DB on demand
}

export async function loadAll(userId: string): Promise<void> {
  setUserId(userId);
}

// Async functions for accessing the database
export async function getCampaigns(): Promise<Campaign[]> {
  if (!electronAPI) {
    // Fallback for browser dev mode when Electron IPC is unavailable
    const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.campaigns);
    return stored ? JSON.parse(stored) : [];
  }
  let rows: any[] = [];
  try {
    rows = await electronAPI.dbQuery('SELECT * FROM campaigns');
  } catch (error) {
    console.error('getCampaigns DB query failed, falling back to localStorage', error);
    const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.campaigns);
    return stored ? JSON.parse(stored) : [];
  }
  return rows.map(row => ({
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    url: row.url,
    category: row.category,
    status: row.status,
    creditsAllocated: row.credits_allocated,
    creditsUsed: row.credits_used,
    dailyLimit: row.daily_limit,
    targetCountries: row.target_countries ? row.target_countries.split(',') : [],
    targetDevices: row.target_devices ? row.target_devices.split(',') : [],
    visitsReceived: row.visits_received,
    mode: row.mode || 'direct',
    searchEngine: row.search_engine,
    searchKeywords: row.search_keywords,
    searchPlatform: row.search_platform,
    searchTargetName: row.search_target_name,
    searchPage: row.search_page,
    searchSort: row.search_sort,
    createdAt: row.created_at,
  }));
}

export async function getActivities(userId?: string): Promise<Activity[]> {
  if (!electronAPI) {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.activities);
    const activities: Activity[] = stored ? JSON.parse(stored) : [];
    if (userId) {
      return activities.filter(a => (a as any).userId === userId);
    }
    return activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }
  const sql = userId ? 'SELECT * FROM activities WHERE user_id = ? ORDER BY created_at DESC' : 'SELECT * FROM activities ORDER BY created_at DESC';
  const params = userId ? [userId] : [];
  const rows: any[] = await electronAPI.dbQuery(sql, params);
  return rows.map(row => ({
    id: row.id,
    type: row.type,
    amount: row.amount,
    description: row.description,
    timestamp: row.created_at,
  }));
}

export async function getReferrals(userId?: string): Promise<Referral[]> {
  if (!electronAPI) return [];
  const sql = userId ? 'SELECT * FROM referrals WHERE referrer_id = ?' : 'SELECT * FROM referrals';
  const params = userId ? [userId] : [];
  const rows: any[] = await electronAPI.dbQuery(sql, params);
  return rows.map(row => ({
    id: row.id,
    email: row.referred_email || '',
    joinedAt: row.joined_at,
    status: row.status,
    earnings: row.earnings,
    level: 1,
  }));
}

export function onDataChange(cb: () => void): () => void {
  const h = () => cb();
  window.addEventListener("data:changed", h);
  return () => window.removeEventListener("data:changed", h);
}

export async function addCampaign(input: {
  title: string;
  url: string;
  category?: string;
  creditsAllocated?: number;
  dailyLimit: number;
  targetCountries?: string[];
  mode?: 'direct' | 'search' | 'freelancing';
  searchEngine?: string;
  searchKeywords?: string;
  searchPlatform?: string;
  searchTargetName?: string;
  searchPage?: number;
  searchSort?: string;
  searchGigTitle?: string;
}): Promise<Campaign | null> {
  const id = Date.now().toString();
  console.log('addCampaign _userId:', _userId);
  const campaign: Campaign = {
    id,
    ownerId: _userId || "mock-user",
    title: input.title,
    url: input.url,
    category: input.category || '',
    status: "active",
    creditsAllocated: input.creditsAllocated ?? 1000000,
    creditsUsed: 0,
    dailyLimit: input.dailyLimit,
    targetCountries: input.targetCountries || [],
    targetDevices: ["desktop", "mobile"],
    visitsReceived: 0,
    mode: input.mode || 'direct',
    searchEngine: input.searchEngine,
    searchKeywords: input.searchKeywords,
    searchPlatform: input.searchPlatform,
    searchTargetName: input.searchTargetName,
    searchPage: input.searchPage,
    searchSort: input.searchSort,
    searchGigTitle: input.searchGigTitle,
    createdAt: new Date().toISOString(),
  };
  console.log('Created campaign:', campaign);

  if (!electronAPI) {
    const campaigns = await getCampaigns();
    campaigns.push(campaign);
    localStorage.setItem(LOCAL_STORAGE_KEYS.campaigns, JSON.stringify(campaigns));
    dispatch();
    return campaign;
  }

  try {
    await electronAPI.dbQuery(`
      INSERT INTO campaigns 
    (id, owner_id, title, url, category, status, credits_allocated, credits_used, daily_limit, target_countries, target_devices, visits_received, mode, search_engine, search_keywords, search_platform, search_target_name, search_page, search_sort, search_gig_title, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    campaign.id,
    campaign.ownerId,
    campaign.title,
    campaign.url,
    campaign.category,
    campaign.status,
    campaign.creditsAllocated,
    campaign.creditsUsed,
    campaign.dailyLimit,
    (campaign.targetCountries || []).join(','),
    campaign.targetDevices.join(','),
    campaign.visitsReceived,
    campaign.mode,
    campaign.searchEngine,
    campaign.searchKeywords,
    campaign.searchPlatform,
    campaign.searchTargetName,
    campaign.searchPage,
    campaign.searchSort,
    campaign.searchGigTitle,
    campaign.createdAt,
  ]);
  } catch (error) {
    console.error('addCampaign DB insert failed, falling back to localStorage', error);
    const campaigns = await getCampaigns();
    campaigns.push(campaign);
    localStorage.setItem(LOCAL_STORAGE_KEYS.campaigns, JSON.stringify(campaigns));
  }

  dispatch();
  return campaign;
}

export async function updateCampaign(id: string, patch: Partial<Campaign>): Promise<void> {
  if (!electronAPI) {
    const campaigns = await getCampaigns();
    const index = campaigns.findIndex(c => c.id === id);
    if (index !== -1) {
      campaigns[index] = { ...campaigns[index], ...patch };
      localStorage.setItem(LOCAL_STORAGE_KEYS.campaigns, JSON.stringify(campaigns));
    }
    dispatch();
    return;
  }

  try {
    const updates: string[] = [];
    const params: any[] = [];

    if (patch.title) { updates.push('title = ?'); params.push(patch.title); }
    if (patch.url) { updates.push('url = ?'); params.push(patch.url); }
    if (patch.category) { updates.push('category = ?'); params.push(patch.category); }
    if (patch.status) { updates.push('status = ?'); params.push(patch.status); }
    if (patch.creditsAllocated !== undefined) { updates.push('credits_allocated = ?'); params.push(patch.creditsAllocated); }
    if (patch.creditsUsed !== undefined) { updates.push('credits_used = ?'); params.push(patch.creditsUsed); }
    if (patch.dailyLimit !== undefined) { updates.push('daily_limit = ?'); params.push(patch.dailyLimit); }
    if (patch.targetCountries) { updates.push('target_countries = ?'); params.push(patch.targetCountries.join(',')); }
    if (patch.visitsReceived !== undefined) { updates.push('visits_received = ?'); params.push(patch.visitsReceived); }
    if (patch.mode !== undefined) { updates.push('mode = ?'); params.push(patch.mode); }
    if (patch.searchEngine !== undefined) { updates.push('search_engine = ?'); params.push(patch.searchEngine); }
    if (patch.searchKeywords !== undefined) { updates.push('search_keywords = ?'); params.push(patch.searchKeywords); }
    if (patch.searchPlatform !== undefined) { updates.push('search_platform = ?'); params.push(patch.searchPlatform); }
    if (patch.searchTargetName !== undefined) { updates.push('search_target_name = ?'); params.push(patch.searchTargetName); }
    if (patch.searchPage !== undefined) { updates.push('search_page = ?'); params.push(patch.searchPage); }
    if (patch.searchSort !== undefined) { updates.push('search_sort = ?'); params.push(patch.searchSort); }

    params.push(id);
    await electronAPI.dbQuery(`UPDATE campaigns SET ${updates.join(',')} WHERE id = ?`, params);
    dispatch();
  } catch (error) {
    console.error('updateCampaign DB update failed, falling back to localStorage', error);
    const campaigns = await getCampaigns();
    const index = campaigns.findIndex(c => c.id === id);
    if (index !== -1) {
      campaigns[index] = { ...campaigns[index], ...patch };
      localStorage.setItem(LOCAL_STORAGE_KEYS.campaigns, JSON.stringify(campaigns));
    }
    dispatch();
  }
}

export async function deleteCampaign(id: string): Promise<void> {
  if (!electronAPI) {
    const campaigns = await getCampaigns();
    const filtered = campaigns.filter(c => c.id !== id);
    localStorage.setItem(LOCAL_STORAGE_KEYS.campaigns, JSON.stringify(filtered));
    dispatch();
    return;
  }
  try {
    await electronAPI.dbQuery('DELETE FROM campaigns WHERE id = ?', [id]);
    dispatch();
  } catch (error) {
    console.error('deleteCampaign DB delete failed, falling back to localStorage', error);
    const campaigns = await getCampaigns();
    const filtered = campaigns.filter(c => c.id !== id);
    localStorage.setItem(LOCAL_STORAGE_KEYS.campaigns, JSON.stringify(filtered));
    dispatch();
  }
}

export async function addActivity(input: {
  type: Activity["type"];
  amount: number;
  description: string;
  campaignId?: string | null;
  userId?: string;
}): Promise<void> {
  const id = `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const activity: Activity & { userId?: string; campaignId?: string | null } = {
    id,
    type: input.type,
    amount: input.amount,
    description: input.description,
    timestamp: new Date().toISOString(),
    userId: input.userId || _userId || 'mock-user',
    campaignId: input.campaignId || null,
  };

  if (!electronAPI) {
    const activities = await getActivities();
    activities.unshift(activity);
    localStorage.setItem(LOCAL_STORAGE_KEYS.activities, JSON.stringify(activities));
    dispatch();
    return;
  }

  await electronAPI.dbQuery(`
    INSERT INTO activities 
    (id, user_id, type, amount, description, campaign_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    id,
    input.userId || _userId || 'mock-user',
    input.type,
    input.amount,
    input.description,
    input.campaignId || null,
    new Date().toISOString(),
  ]);

  dispatch();
}

// Add missing functions for Dashboard and Analytics pages
export async function getTodayEarned(): Promise<number> {
  if (!electronAPI) {
    const activities = await getActivities();
    const today = new Date().toISOString().split('T')[0];
    return activities
      .filter(a => a.type === 'earn' && a.timestamp.startsWith(today))
      .reduce((sum, a) => sum + a.amount, 0);
  }
  const today = new Date().toISOString().split('T')[0];
  const rows: any[] = await electronAPI.dbQuery(
    "SELECT SUM(amount) as total FROM activities WHERE type = 'earn' AND created_at LIKE ?",
    [`${today}%`]
  );
  return rows[0]?.total || 0;
}

export async function getDailyActivity(): Promise<{ date: string; earned: number; spent: number }[]> {
  if (!electronAPI) {
    const activities = await getActivities();
    const dailyMap = new Map<string, { earned: number; spent: number }>();
    activities.forEach(a => {
      const date = a.timestamp.split('T')[0];
      const entry = dailyMap.get(date) || { earned: 0, spent: 0 };
      if (a.type === 'earn') entry.earned += a.amount;
      if (a.type === 'spend') entry.spent += a.amount;
      dailyMap.set(date, entry);
    });
    return Array.from(dailyMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 14);
  }
  const rows: any[] = await electronAPI.dbQuery(`
    SELECT 
      DATE(created_at) as date,
      SUM(CASE WHEN type = 'earn' THEN amount ELSE 0 END) as earned,
      SUM(CASE WHEN type = 'spend' THEN amount ELSE 0 END) as spent
    FROM activities
    GROUP BY DATE(created_at)
    ORDER BY date DESC
    LIMIT 14
  `);
  return rows.map(row => ({
    date: row.date,
    earned: row.earned || 0,
    spent: row.spent || 0
  }));
}

async function hashString(input: string) {
  if (!input) return null;
  if ((window as any).crypto && (window as any).crypto.subtle) {
    const enc = new TextEncoder();
    const data = enc.encode(input);
    const hash = await (window as any).crypto.subtle.digest('SHA-256', data);
    const arr = Array.from(new Uint8Array(hash));
    return arr.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback simple hash
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h << 5) - h + input.charCodeAt(i);
  return String(h >>> 0);
}

export async function addVisitorEvent(input: {
  campaignId?: string | null;
  ip?: string | null;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  userAgent?: string | null;
  browser?: string | null;
  os?: string | null;
  deviceType?: string | null;
  referrer?: string | null;
  sessionId?: string | null;
}): Promise<void> {
  if (!electronAPI) {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.visitors);
    const visitors = stored ? JSON.parse(stored) : [];
    const id = `v_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const ipHash = input.ip ? await hashString(input.ip) : null;
    visitors.unshift({
      id,
      campaignId: input.campaignId || null,
      ip: input.ip || null,
      ipHash,
      country: input.country || null,
      region: input.region || null,
      city: input.city || null,
      latitude: input.latitude || null,
      longitude: input.longitude || null,
      userAgent: input.userAgent || null,
      browser: input.browser || null,
      os: input.os || null,
      deviceType: input.deviceType || null,
      referrer: input.referrer || null,
      sessionId: input.sessionId || null,
      createdAt: new Date().toISOString(),
    });
    localStorage.setItem(LOCAL_STORAGE_KEYS.visitors, JSON.stringify(visitors));
    dispatch();
    return;
  }
  const id = `v_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const ipHash = input.ip ? await hashString(input.ip) : null;

  await electronAPI.dbQuery(`
    INSERT INTO visitors
    (id, campaign_id, ip, ip_hash, country, region, city, latitude, longitude, user_agent, browser, os, device_type, referrer, session_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id,
    input.campaignId || null,
    input.ip || null,
    ipHash,
    input.country || null,
    input.region || null,
    input.city || null,
    input.latitude || null,
    input.longitude || null,
    input.userAgent || null,
    input.browser || null,
    input.os || null,
    input.deviceType || null,
    input.referrer || null,
    input.sessionId || null,
    new Date().toISOString(),
  ]);

  dispatch();
}

export async function getUsers(): Promise<User[]> {
  if (isSupabaseEnabled) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      avatar: row.avatar || undefined,
      bio: row.bio || undefined,
      role: row.role,
      credits: row.credits ?? 0,
      createdAt: row.created_at || row.createdAt || new Date().toISOString(),
      emailVerified: row.email_verified ?? true,
      referralCode: row.referral_code || row.referralCode || `REF-${row.id.slice(0, 6).toUpperCase()}`,
      referredBy: row.referred_by || row.referredBy || null,
      storeRawIps: row.store_raw_ips ?? row.storeRawIps,
      lastLoginAt: row.last_login_at || row.lastLoginAt,
      lastLoginIp: row.last_login_ip || row.lastLoginIp,
      lastDevice: row.last_device || row.lastDevice,
      lastLocation: row.last_location || row.lastLocation,
      lastUserAgent: row.last_user_agent || row.lastUserAgent,
      lastCountry: row.last_country || row.lastCountry,
      lastRegion: row.last_region || row.lastRegion,
      lastCity: row.last_city || row.lastCity,
    }));
  }

  if (!electronAPI) {
    const stored = localStorage.getItem('trafficplus_all_users');
    return stored ? JSON.parse(stored) : [];
  }
  const rows: any[] = await electronAPI.userList();
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    avatar: row.avatar || undefined,
    bio: row.bio || undefined,
    role: row.role,
    credits: row.credits,
    createdAt: row.createdAt,
    emailVerified: true,
    referralCode: row.referralCode || `REF-${row.id.slice(0, 6).toUpperCase()}`,
    referredBy: null,
    storeRawIps: row.storeRawIps,
    lastLoginAt: row.lastLoginAt,
    lastLoginIp: row.lastLoginIp,
    lastDevice: row.lastDevice,
    lastLocation: row.lastLocation,
    lastUserAgent: row.lastUserAgent,
    lastCountry: row.lastCountry,
    lastRegion: row.lastRegion,
    lastCity: row.lastCity,
  }));
}

export function formatNotificationRow(row: any): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type as 'info' | 'success' | 'warning' | 'error',
    title: row.title,
    message: row.message,
    read: !!row.read,
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
  };
}

export async function getNotifications(userId: string): Promise<Notification[]> {
  if (isSupabaseEnabled) {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(formatNotificationRow);
  }

  if (!electronAPI) return [];
  return electronAPI.notificationsGet(userId);
}

export async function sendNotification(userId: string, type: 'info' | 'success' | 'warning' | 'error', title: string, message: string): Promise<void> {
  if (isSupabaseEnabled) {
    const { error } = await supabase.from('notifications').insert({
      user_id: userId,
      type,
      title,
      message,
      read: false,
      created_at: new Date().toISOString(),
    });
    if (error) throw error;
    return;
  }

  if (!electronAPI) return;
  await electronAPI.notificationsCreate(userId, type, title, message);
}

export async function broadcastNotification(type: 'info' | 'success' | 'warning' | 'error', title: string, message: string): Promise<void> {
  if (isSupabaseEnabled) {
    const users = await getUsers();
    const inserts = users.map((user) => ({
      user_id: user.id,
      type,
      title,
      message,
      read: false,
      created_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from('notifications').insert(inserts);
    if (error) throw error;
    return;
  }

  if (!electronAPI) return;
  const users = await getUsers();
  await Promise.all(users.map((user) => electronAPI.notificationsCreate(user.id, type, title, message)));
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  if (isSupabaseEnabled) {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);
    if (error) throw error;
    return;
  }

  if (!electronAPI) return;
  await electronAPI.notificationsMarkRead(notificationId);
}

export async function deleteNotification(notificationId: string): Promise<void> {
  if (isSupabaseEnabled) {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);
    if (error) throw error;
    return;
  }

  if (!electronAPI) return;
  await electronAPI.notificationsDelete(notificationId);
}

export async function getRecentVisitors(limit = 50) {
  if (!electronAPI) {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.visitors);
    return stored ? JSON.parse(stored).slice(0, limit) : [];
  }
  const rows: any[] = await electronAPI.dbQuery('SELECT * FROM visitors ORDER BY created_at DESC LIMIT ?', [limit]);
  return rows.map(r => ({
    id: r.id,
    campaignId: r.campaign_id,
    ip: r.ip,
    ipHash: r.ip_hash,
    country: r.country,
    region: r.region,
    city: r.city,
    latitude: r.latitude,
    longitude: r.longitude,
    userAgent: r.user_agent,
    browser: r.browser,
    os: r.os,
    deviceType: r.device_type,
    referrer: r.referrer,
    sessionId: r.session_id,
    createdAt: r.created_at,
  }));
}

export async function getLiveVisitorCount(windowMinutes = 5) {
  if (!electronAPI) {
    const visitors = await getRecentVisitors(1000);
    const cutoff = Date.now() - windowMinutes * 60 * 1000;
    const uniqueSessions = new Set(
      visitors
        .filter(v => new Date(v.createdAt).getTime() > cutoff)
        .map(v => v.sessionId)
        .filter(Boolean)
    );
    return uniqueSessions.size;
  }
  const rows: any[] = await electronAPI.dbQuery(
    `SELECT COUNT(DISTINCT session_id) as cnt FROM visitors WHERE created_at > datetime('now', ?)`,
    [`-${windowMinutes} minutes`]
  );
  return rows[0]?.cnt || 0;
}

export async function getTopCountries(limit = 10) {
  if (!electronAPI) {
    const visitors = await getRecentVisitors(1000);
    const countryCounts = new Map<string, number>();
    visitors.forEach(v => {
      if (v.country) {
        countryCounts.set(v.country, (countryCounts.get(v.country) || 0) + 1);
      }
    });
    return Array.from(countryCounts.entries())
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }
  const rows: any[] = await electronAPI.dbQuery(
    `SELECT country, COUNT(*) as cnt FROM visitors WHERE country IS NOT NULL GROUP BY country ORDER BY cnt DESC LIMIT ?`,
    [limit]
  );
  return rows.map(r => ({ country: r.country, count: r.cnt }));
}

// Keep compatibility functions
export async function getCampaignsAsync(): Promise<Campaign[]> {
  return await getCampaigns();
}
export async function getCampaignsDB(): Promise<Campaign[]> {
  return await getCampaigns();
}

export async function getActivitiesAsync(): Promise<Activity[]> {
  return await getActivities();
}
export async function getActivitiesDB(): Promise<Activity[]> {
  return await getActivities();
}

export async function getReferralsAsync(): Promise<Referral[]> {
  return await getReferrals();
}
export async function getReferralsDB(): Promise<Referral[]> {
  return await getReferrals();
}

// Proxy functions
export async function getProxies(userId?: string): Promise<Proxy[]> {
  if (!electronAPI) {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.proxies);
    const proxies: Proxy[] = stored ? JSON.parse(stored) : [];
    if (userId) {
      return proxies.filter(p => p.userId === userId);
    }
    return proxies;
  }
  const rows: any[] = await electronAPI.proxiesGet(userId || _userId);
  return rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    type: row.type,
    host: row.host,
    port: row.port,
    username: row.username,
    password: row.password,
    country: row.country,
    timezone: row.timezone,
    language: row.language,
    createdAt: row.created_at
  }));
}

export async function addProxy(input: {
  type?: 'http' | 'https' | 'socks4' | 'socks5';
  host: string;
  port: number;
  username?: string;
  password?: string;
  country?: string;
  timezone?: string;
  language?: string;
}): Promise<Proxy | null> {
  if (!electronAPI) {
    const id = Date.now().toString();
    const proxy: Proxy = {
      id,
      userId: _userId || 'mock-user',
      type: input.type || 'http',
      host: input.host,
      port: input.port,
      username: input.username,
      password: input.password,
      country: input.country,
      timezone: input.timezone,
      language: input.language,
      createdAt: new Date().toISOString()
    };
    const proxies = await getProxies();
    proxies.push(proxy);
    localStorage.setItem(LOCAL_STORAGE_KEYS.proxies, JSON.stringify(proxies));
    dispatch();
    return proxy;
  }
  return await electronAPI.proxiesCreate(
    _userId || 'mock-user',
    input.type,
    input.host,
    input.port,
    input.username,
    input.password,
    input.country,
    input.timezone,
    input.language
  );
}

export async function updateProxy(id: string, patch: Partial<Proxy>): Promise<void> {
  if (!electronAPI) {
    const proxies = await getProxies();
    const index = proxies.findIndex(p => p.id === id);
    if (index !== -1) {
      proxies[index] = { ...proxies[index], ...patch };
      localStorage.setItem(LOCAL_STORAGE_KEYS.proxies, JSON.stringify(proxies));
    }
    dispatch();
    return;
  }
  await electronAPI.proxiesUpdate(id, patch);
  dispatch();
}

export async function deleteProxy(id: string): Promise<void> {
  if (!electronAPI) {
    const proxies = await getProxies();
    const filtered = proxies.filter(p => p.id !== id);
    localStorage.setItem(LOCAL_STORAGE_KEYS.proxies, JSON.stringify(filtered));
    dispatch();
    return;
  }
  await electronAPI.proxiesDelete(id);
  dispatch();
}

export async function importProxiesFromFile(filePath: string): Promise<any> {
  console.log('[storage] importProxiesFromFile called with filePath:', filePath, '_userId:', _userId);
  if (!electronAPI) return null;
  const result = await electronAPI.proxiesImportFile(_userId || 'mock-user', filePath);
  console.log('[storage] importProxiesFromFile result from electronAPI:', result);
  dispatch();
  return result;
}

function parseProxyLine(line: string) {
  line = line.trim();
  if (!line) return null;
  
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
      const proxy: any = {};
      fields.forEach((field, i) => {
        proxy[field] = match[i + 1];
      });
      if (defaultType && !proxy.type) {
        proxy.type = defaultType;
      }
      const port = parseInt(proxy.port);
      if (isNaN(port) || port <= 0 || port > 65535) {
        return null;
      }
      return {
        type: (proxy.type || 'http').toLowerCase().replace(/socks$/, 'socks5') as any,
        host: proxy.host,
        port: port,
        username: proxy.username || undefined,
        password: proxy.password || undefined,
      };
    }
  }
  return null;
}

function parseProxies(content: string): Partial<Proxy>[] {
  const proxies: Partial<Proxy>[] = [];
  
  // Try JSON first
  try {
    const jsonData = JSON.parse(content);
    if (Array.isArray(jsonData)) {
      jsonData.forEach((item: any) => {
        if (item.host && item.port) {
          proxies.push({
            type: (item.type || 'http').toLowerCase().replace(/socks$/, 'socks5') as any,
            host: item.host,
            port: parseInt(item.port),
            username: item.username || item.user || undefined,
            password: item.password || item.pass || undefined,
            country: item.country || undefined,
            timezone: item.timezone || undefined,
            language: item.language || 'en-US',
          });
        }
      });
      return proxies;
    }
  } catch (e) {
    // Ignore JSON error
  }

  // Try line-by-line
  const lines = content.split(/[\r\n]+/);
  lines.forEach((line) => {
    const parsed = parseProxyLine(line);
    if (parsed) {
      proxies.push({
        ...parsed,
        language: 'en-US',
      });
    }
  });

  return proxies;
}

export async function importProxiesFromContent(content: string): Promise<any> {
  console.log('[storage] importProxiesFromContent called with content length:', content?.length, '_userId:', _userId);
  if (!electronAPI) {
    const parsed = parseProxies(content);
    const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.proxies);
    const existing: Proxy[] = stored ? JSON.parse(stored) : [];
    const imported: Proxy[] = [];
    
    parsed.forEach((p) => {
      const id = `proxy-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const proxy: Proxy = {
        id,
        userId: _userId || 'mock-user',
        type: p.type || 'http',
        host: p.host || '',
        port: p.port || 80,
        username: p.username,
        password: p.password,
        country: p.country,
        timezone: p.timezone,
        language: p.language || 'en-US',
        createdAt: new Date().toISOString(),
      };
      existing.push(proxy);
      imported.push(proxy);
    });
    
    localStorage.setItem(LOCAL_STORAGE_KEYS.proxies, JSON.stringify(existing));
    dispatch();
    return { success: true, count: imported.length, proxies: imported };
  }
  const result = await electronAPI.proxiesImportContent(_userId || 'mock-user', content);
  console.log('[storage] importProxiesFromContent result from electronAPI:', result);
  dispatch();
  return result;
}

export async function clearAllProxies(userId?: string): Promise<void> {
  const uid = userId || _userId || 'mock-user';
  if (!electronAPI) {
    localStorage.removeItem(LOCAL_STORAGE_KEYS.proxies);
    dispatch();
    return;
  }
  await electronAPI.dbQuery('DELETE FROM proxies WHERE user_id = ?', [uid]);
  dispatch();
}

export async function deleteProxiesByIds(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  if (!electronAPI) {
    const proxies = await getProxies();
    const filtered = proxies.filter(p => !ids.includes(p.id));
    localStorage.setItem(LOCAL_STORAGE_KEYS.proxies, JSON.stringify(filtered));
    dispatch();
    return;
  }
  const placeholders = ids.map(() => '?').join(',');
  await electronAPI.dbQuery(`DELETE FROM proxies WHERE id IN (${placeholders})`, ids);
  dispatch();
}

export async function scrapeProxiesFromUrl(url) {
  if (!electronAPI) return null;
  const result = await electronAPI.proxiesScrape(_userId || 'mock-user', url);
  dispatch();
  return result;
}

export async function testProxy(proxy) {
  if (!electronAPI) return null;
  return await electronAPI.proxiesTest(proxy);
}

// Site Settings functions
const DEFAULT_SETTINGS: SiteSettings = {
  id: 'site-settings',
  siteName: 'TrafficPlus',
  siteDescription: 'Automate traffic, boost SEO, and earn credits.',
  heroTitle: 'Automated Traffic That Converts',
  heroSubtitle: 'Human-like browsing behavior, proxies, and search engine automation in one desktop app.',
  heroButtonText: 'Get Started Free',
  heroSecondaryButtonText: 'Learn More',
  footerText: 'Powered by TrafficPlus — The future of ethical traffic automation.',
  copyrightText: `© ${new Date().getFullYear()} TrafficPlus. All rights reserved.`,
  authRequired: true,
  features: [
    { icon: 'globe', title: 'Search Automation', description: 'Find your site in search engines and navigate with human behavior.' },
    { icon: 'shield', title: 'Proxies & Rotation', description: 'Use HTTP/HTTPS/SOCKS4/5 proxies with automatic rotation.' },
    { icon: 'zap', title: 'Human-Like', description: 'Simulate real browsing with typos, mouse curves, and delays.' }
  ],
  updatedAt: new Date().toISOString()
};

// Add default feature pages visibility
DEFAULT_SETTINGS.featurePages = {
  savedCampaigns: true,
  credits: true,
  referrals: true,
  contacts: true,
  premium: true
};

export async function getSiteSettings(): Promise<SiteSettings> {
  if (!electronAPI) {
    // Fallback: use localStorage for browser mode
    const stored = localStorage.getItem('trafficplus-site-settings');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        // If parsing fails, return defaults
      }
    }
    return DEFAULT_SETTINGS;
  }

  // Try to get from DB
  const rows: any[] = await electronAPI.dbQuery('SELECT * FROM site_settings WHERE id = ?', ['site-settings']);

  if (rows.length > 0) {
    const row = rows[0];
    return {
      id: row.id,
      siteName: row.site_name,
      siteDescription: row.site_description,
      siteLogo: row.site_logo,
      heroTitle: row.hero_title,
      heroSubtitle: row.hero_subtitle,
      heroButtonText: row.hero_button_text,
      heroSecondaryButtonText: row.hero_secondary_button_text,
      footerText: row.footer_text,
      copyrightText: row.copyright_text,
      primaryColor: row.primary_color,
      secondaryColor: row.secondary_color,
      authRequired: row.auth_required === 1,
      features: row.features ? JSON.parse(row.features) : DEFAULT_SETTINGS.features,
      testimonials: row.testimonials ? JSON.parse(row.testimonials) : undefined,
      featurePages: row.feature_pages ? JSON.parse(row.feature_pages) : DEFAULT_SETTINGS.featurePages,
      updatedAt: row.updated_at
    };
  }

  // If not found, insert defaults and return them
  await setSiteSettings(DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}

export async function setSiteSettings(settings: Partial<SiteSettings>): Promise<void> {
  const current = await getSiteSettings();
  const updated: SiteSettings = {
    ...current,
    ...settings,
    id: 'site-settings',
    updatedAt: new Date().toISOString()
  };

  if (!electronAPI) {
    localStorage.setItem('trafficplus-site-settings', JSON.stringify(updated));
    dispatch();
    return;
  }

  // Try to update first
  const result = await electronAPI.dbQuery(
    `UPDATE site_settings SET 
      site_name = ?, site_description = ?, site_logo = ?,
      hero_title = ?, hero_subtitle = ?, hero_button_text = ?, hero_secondary_button_text = ?,
      footer_text = ?, copyright_text = ?, primary_color = ?, secondary_color = ?,
      auth_required = ?, features = ?, testimonials = ?, feature_pages = ?, updated_at = ?
      WHERE id = ?`,
    [
      updated.siteName,
      updated.siteDescription,
      updated.siteLogo || null,
      updated.heroTitle,
      updated.heroSubtitle,
      updated.heroButtonText,
      updated.heroSecondaryButtonText,
      updated.footerText,
      updated.copyrightText,
      updated.primaryColor || null,
      updated.secondaryColor || null,
      updated.authRequired ? 1 : 0,
      JSON.stringify(updated.features),
      updated.testimonials ? JSON.stringify(updated.testimonials) : null,
      updated.featurePages ? JSON.stringify(updated.featurePages) : null,
      updated.updatedAt,
      'site-settings'
    ]
  );
  // If no rows were affected, insert new record
  if (result.changes === 0) {
    await electronAPI.dbQuery(
      `INSERT INTO site_settings 
        (id, site_name, site_description, site_logo, hero_title, hero_subtitle, 
         hero_button_text, hero_secondary_button_text, footer_text, copyright_text,
         primary_color, secondary_color, auth_required, features, testimonials, feature_pages, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'site-settings',
        updated.siteName,
        updated.siteDescription,
        updated.siteLogo || null,
        updated.heroTitle,
        updated.heroSubtitle,
        updated.heroButtonText,
        updated.heroSecondaryButtonText,
        updated.footerText,
        updated.copyrightText,
        updated.primaryColor || null,
        updated.secondaryColor || null,
        updated.authRequired ? 1 : 0,
        JSON.stringify(updated.features),
        updated.testimonials ? JSON.stringify(updated.testimonials) : null,
        updated.featurePages ? JSON.stringify(updated.featurePages) : null,
        updated.updatedAt
      ]
    );
  }
  dispatch();
}
