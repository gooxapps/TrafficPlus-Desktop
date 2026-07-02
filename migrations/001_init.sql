-- Migration: initial schema for Supabase Postgres
-- Run with: supabase db push --file migrations/001_init.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT DEFAULT 'user',
  credits INTEGER DEFAULT 250,
  avatar TEXT,
  bio TEXT,
  store_raw_ips BOOLEAN DEFAULT FALSE,
  last_login_at TIMESTAMPTZ,
  last_login_ip TEXT,
  last_device TEXT,
  last_location TEXT,
  last_user_agent TEXT,
  last_country TEXT,
  last_region TEXT,
  last_city TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_login_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_login_at TIMESTAMPTZ,
  last_login_ip TEXT,
  last_device TEXT,
  last_location TEXT,
  last_user_agent TEXT,
  last_country TEXT,
  last_region TEXT,
  last_city TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id),
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
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  description TEXT,
  campaign_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS referrals (
  id TEXT PRIMARY KEY,
  referrer_id TEXT NOT NULL REFERENCES users(id),
  referred_email TEXT,
  referred_phone TEXT,
  status TEXT DEFAULT 'active',
  earnings INTEGER DEFAULT 0,
  joined_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS saved_campaigns (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
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
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS proxies (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL DEFAULT 'http',
  host TEXT NOT NULL,
  port INTEGER NOT NULL,
  username TEXT,
  password TEXT,
  country TEXT,
  timezone TEXT,
  language TEXT DEFAULT 'en-US',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS visitors (
  id TEXT PRIMARY KEY,
  campaign_id TEXT REFERENCES campaigns(id),
  ip TEXT,
  ip_hash TEXT,
  country TEXT,
  region TEXT,
  city TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  user_agent TEXT,
  browser TEXT,
  os TEXT,
  device_type TEXT,
  referrer TEXT,
  session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
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
  auth_required BOOLEAN NOT NULL DEFAULT FALSE,
  features TEXT,
  testimonials TEXT,
  feature_pages TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_visitors_created_at ON visitors(created_at);
