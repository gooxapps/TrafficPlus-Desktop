import type { User } from "@/types";

export function generateReferralCode(name: string): string {
  const base = (name || "USER").replace(/\s+/g, "").slice(0, 5).toUpperCase() || "USER";
  return `${base}-${Math.floor(1000 + Math.random() * 9000)}`;
}

const STORAGE_KEY = "trafficplus_user";
const ALL_USERS_KEY = "trafficplus_all_users";

export async function signInOrSignUp({
  name,
  email,
  phone,
  refCode,
}: {
  name: string;
  email?: string;
  phone?: string;
  refCode?: string;
}): Promise<void> {
  const electronAPI = (window as any).electronAPI;
  const allUsers: User[] = JSON.parse(localStorage.getItem(ALL_USERS_KEY) || "[]");

  let user = allUsers.find(u =>
    (email && u.email === email) ||
    (phone && u.phone === phone)
  );

  if (electronAPI) {
    try {
      const rows: any[] = await electronAPI.dbQuery(
        'SELECT * FROM users WHERE email = ? OR phone = ?',
        [email || null, phone || null]
      );
      const dbUser = rows.find((u) =>
        (email && u.email === email) ||
        (phone && u.phone === phone)
      );
      if (dbUser) {
        user = {
          id: dbUser.id,
          name: dbUser.name,
          email: dbUser.email || "",
          phone: dbUser.phone || "",
          role: dbUser.role || "user",
          credits: dbUser.credits ?? 250,
          referralCode: `REF-${(dbUser.id || "").slice(0, 6).toUpperCase()}`,
          createdAt: dbUser.created_at || new Date().toISOString(),
          emailVerified: true,
          referredBy: null,
          avatar: dbUser.avatar || undefined,
          bio: dbUser.bio || undefined,
          storeRawIps: dbUser.store_raw_ips === 1,
          lastLoginAt: dbUser.last_login_at || undefined,
          lastLoginIp: dbUser.last_login_ip || undefined,
          lastDevice: dbUser.last_device || undefined,
          lastLocation: dbUser.last_location || undefined,
          lastUserAgent: dbUser.last_user_agent || undefined,
          lastCountry: dbUser.last_country || undefined,
          lastRegion: dbUser.last_region || undefined,
          lastCity: dbUser.last_city || undefined,
        };
      }
    } catch (err) {
      console.error("Error querying DB user for sign in:", err);
    }
  }

  if (!user) {
    user = {
      id: Date.now().toString(),
      name,
      email: email || "",
      phone: phone || "",
      role: "user",
      credits: 250,
      referralCode: generateReferralCode(name),
      createdAt: new Date().toISOString(),
      emailVerified: true,
      referredBy: null,
    };

    if (refCode) {
      const referrer = allUsers.find(u => u.referralCode === refCode);
      if (referrer) {
        user.referredBy = referrer.id;
      }
    }

    allUsers.push(user);
    localStorage.setItem(ALL_USERS_KEY, JSON.stringify(allUsers));
  }

  if (electronAPI) {
    try {
      await electronAPI.userUpsert({
        ...user,
        storeRawIps: false,
      });
      const loginMeta = {
        lastLoginAt: new Date().toISOString(),
        lastLoginIp: null,
        lastDevice: navigator.platform || navigator.userAgent,
        lastLocation: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
        lastUserAgent: navigator.userAgent,
        lastCountry: null,
        lastRegion: null,
        lastCity: null,
      };
      await electronAPI.userTrackLogin(user.id, loginMeta);
    } catch (err) {
      console.error("Error saving sign-in metadata:", err);
    }
  }

  // Sign user in
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  
  // Trigger event for useAuth
  window.dispatchEvent(new CustomEvent("auth_changed"));
}

export async function signOut(): Promise<void> {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("auth_changed"));
}

export async function signInAsAdmin(): Promise<void> {
  const electronAPI = (window as any).electronAPI;
  const adminUser: User = {
    id: 'admin-user',
    name: 'Admin',
    email: 'admin@example.com',
    phone: '',
    role: 'admin',
    credits: 999999,
    referralCode: `REF-ADMIN`,
    createdAt: new Date().toISOString(),
    emailVerified: true,
    referredBy: null,
  };

  if (electronAPI) {
    try {
      await electronAPI.userUpsert({
        ...adminUser,
        storeRawIps: false,
      });
      await electronAPI.userTrackLogin(adminUser.id, {
        lastLoginAt: new Date().toISOString(),
        lastLoginIp: null,
        lastDevice: navigator.platform || navigator.userAgent,
        lastLocation: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
        lastUserAgent: navigator.userAgent,
        lastCountry: null,
        lastRegion: null,
        lastCity: null,
      });
    } catch (err) {
      console.error("Error saving admin sign-in metadata:", err);
    }
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(adminUser));
  window.dispatchEvent(new CustomEvent("auth_changed"));
}

export function getCurrentUser(): User | null {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) {
    return null;
  }

  try {
    return JSON.parse(data);
  } catch {
    // invalid JSON, remove it
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}
