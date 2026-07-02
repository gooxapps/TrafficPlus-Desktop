// Static product catalogs and form constants. All user-facing data
// (campaigns, activities, referrals) lives in src/lib/storage.ts and
// is persisted in real localStorage — no seed data is shipped.

export const CATEGORIES = [
  "Business", "Marketing", "Technology", "E-commerce", "Health",
  "Finance", "Education", "Entertainment", "Travel", "Lifestyle",
];

export const COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "AU", name: "Australia" },
  { code: "IN", name: "India" },
  { code: "BR", name: "Brazil" },
  { code: "JP", name: "Japan" },
];

export const PRICING = [
  {
    id: "weekly", name: "Weekly", price: 4.99, period: "wk", credits: 5000, popular: false,
    features: ["1.5× surf rewards", "Basic analytics", "5 active campaigns", "Email support"],
  },
  {
    id: "monthly", name: "Monthly", price: 14.99, period: "mo", credits: 25000, popular: true,
    features: ["2× surf rewards", "Advanced analytics", "25 active campaigns", "Priority delivery", "Country targeting", "Ad-free surfing"],
  },
  {
    id: "annual", name: "Annual", price: 119.99, period: "yr", credits: 360000, popular: false,
    features: ["3× surf rewards", "Pro analytics suite", "Unlimited campaigns", "Highest priority", "All targeting options", "Dedicated support"],
  },
];

export const CREDIT_PACKS = [
  { id: "p1", credits: 5000, price: 4.99 },
  { id: "p2", credits: 25000, price: 19.99, badge: "Best Value" },
  { id: "p3", credits: 100000, price: 59.99 },
  { id: "p4", credits: 500000, price: 199.99, badge: "Pro" },
];

export const SEARCH_ENGINES = [
  "Google",
  "DuckDuckGo",
  "StaySafeSearch",
];

export const FREELANCE_PLATFORMS = [
  "Fiverr",
  "Upwork",
  "Kwork",
];

export const FREELANCING_SORT_OPTIONS = [
  "Relevance",
  "Best Selling",
  "Newest",
  "Highest Rated",
];

export const NETWORK_PRESETS = [
  "none",
  "slow-2g",
  "2g",
  "slow-3g",
  "3g",
  "4g",
  "5g",
  "slow-wifi",
];
