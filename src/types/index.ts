export type UserRole = "user" | "premium" | "admin";

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
  bio?: string;
  role: UserRole;
  credits: number;
  createdAt: string;
  emailVerified: boolean;
  referralCode: string;
  referredBy?: string;
  storeRawIps?: boolean;
  lastLoginAt?: string;
  lastLoginIp?: string;
  lastDevice?: string;
  lastLocation?: string;
  lastUserAgent?: string;
  lastCountry?: string;
  lastRegion?: string;
  lastCity?: string;
}

export type CampaignMode = 'direct' | 'search' | 'freelancing';

export interface Campaign {
  id: string;
  ownerId: string;
  url: string;
  title: string;
  category: string;
  status: "active" | "paused" | "pending" | "rejected";
  creditsAllocated: number;
  creditsUsed: number;
  visitsReceived: number;
  targetCountries: string[];
  targetDevices: ("desktop" | "mobile" | "tablet")[];
  dailyLimit: number;
  createdAt: string;
  mode?: CampaignMode; // 'direct', 'search' or 'freelancing'
  searchEngine?: string;
  searchKeywords?: string;
  searchPlatform?: string;
  searchTargetName?: string;
  searchPage?: number;
  searchSort?: string;
  searchGigTitle?: string; // for freelancing mode
}

export interface Activity {
  id: string;
  type: "earn" | "spend" | "bonus" | "referral" | "purchase";
  amount: number;
  description: string;
  timestamp: string;
}

export interface SurfSite {
  id: string;
  url: string;
  title: string;
  category: string;
  duration: number;
  reward: number;
}

export interface Referral {
  id: string;
  email: string;
  joinedAt: string;
  status: "active" | "inactive";
  earnings: number;
  level: 1 | 2;
}

export interface Notification {
  id: string;
  userId: string;
  type: "info" | "success" | "warning" | "error";
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface Proxy {
  id: string;
  userId: string;
  type: 'http' | 'https' | 'socks4' | 'socks5';
  host: string;
  port: number;
  username?: string;
  password?: string;
  country?: string;
  timezone?: string;
  language?: string;
  createdAt: string;
  testResult?: ProxyTestResult;
  testing?: boolean;
}

export interface ProxyTestResult {
  working: boolean;
  speed: number; // milliseconds
  exposed: boolean;
  banned: boolean;
  ip: string | null;
  country: string | null;
  error: string | null;
}

export interface SiteSettings {
  id: string;
  siteName: string;
  siteDescription: string;
  siteLogo?: string;
  heroTitle: string;
  heroSubtitle: string;
  heroButtonText: string;
  heroSecondaryButtonText: string;
  footerText: string;
  copyrightText: string;
  primaryColor?: string;
  secondaryColor?: string;
  features: Array<{
    icon: string;
    title: string;
    description: string;
  }>;
  testimonials?: Array<{
    name: string;
    role: string;
    content: string;
    avatar?: string;
  }>;
  authRequired?: boolean;
  featurePages?: {
    savedCampaigns?: boolean;
    credits?: boolean;
    referrals?: boolean;
    contacts?: boolean;
    premium?: boolean;
  };
  updatedAt: string;
}
