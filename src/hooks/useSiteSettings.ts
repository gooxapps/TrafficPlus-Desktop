import { useStoredAsync } from './useStoredAsync';
import { getSiteSettings, setSiteSettings } from '@/lib/storage';
import type { SiteSettings } from '@/types';

// Fallback default settings to use while loading
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

// default flags for page features
DEFAULT_SETTINGS.featurePages = {
  savedCampaigns: true,
  credits: true,
  referrals: true,
  contacts: true,
  premium: true
};

export function useSiteSettings() {
  const settings = useStoredAsync(getSiteSettings, DEFAULT_SETTINGS);

  return {
    settings,
    updateSettings: async (newSettings: Partial<SiteSettings>) => {
      await setSiteSettings(newSettings);
    }
  };
}
