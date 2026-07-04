import { useRef } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard, Globe, Megaphone, Coins, Users, BarChart3,
  Crown, Settings as SettingsIcon, Shield, LogOut, Zap, Bell, UserPlus, Bookmark, Server
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { useSiteSettings } from "@/hooks/useSiteSettings";

const items = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/surf", label: "Surf & Earn", icon: Globe },
  { to: "/campaigns", label: "Campaigns", icon: Megaphone },
  { to: "/saved-campaigns", label: "Saved Campaigns", icon: Bookmark },
  { to: "/proxies", label: "Proxies", icon: Server },
  { to: "/credits", label: "Credits", icon: Coins },
  { to: "/referrals", label: "Referrals", icon: Users },
  { to: "/contacts", label: "Contacts", icon: UserPlus },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/premium", label: "Premium", icon: Crown },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

const adminItems = [
  { to: "/admin", label: "Admin Dashboard", icon: Shield },
  { to: "/admin/users", label: "User Management", icon: Users },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const { settings } = useSiteSettings();
  const navigate = useNavigate();
  const clickCountRef = useRef(0);
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const navItems = user?.role === "admin" ? adminItems : items;

  return (
    <aside className="flex w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border h-screen sticky top-0">
      <div
        className="flex items-center gap-2 h-16 px-6 border-b border-sidebar-border select-none"
        style={{ cursor: 'default' }}
        onClick={() => {
          const nextCount = clickCountRef.current + 1;
          clickCountRef.current = nextCount;
          if (clickTimeoutRef.current) {
            clearTimeout(clickTimeoutRef.current);
          }
          clickTimeoutRef.current = setTimeout(() => {
            clickCountRef.current = 0;
          }, 1500);

          if (nextCount === 7) {
            clickCountRef.current = 0;
            if (clickTimeoutRef.current) {
              clearTimeout(clickTimeoutRef.current);
              clickTimeoutRef.current = null;
            }
            navigate("/admin");
          }
        }}
      >
        {settings.siteLogo ? (
          <img src={settings.siteLogo} alt={settings.siteName} className="w-8 h-8 rounded-lg object-contain" />
        ) : (
          <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
            <Zap className="w-4 h-4 text-primary-foreground" />
          </div>
        )}
        <span className="font-bold tracking-tight">{settings.siteName}</span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((it) => {
          // Respect feature flags: hide menu items when disabled
          const routeToFlag: Record<string, keyof NonNullable<typeof settings.featurePages>> = {
            '/saved-campaigns': 'savedCampaigns',
            '/credits': 'credits',
            '/referrals': 'referrals',
            '/contacts': 'contacts',
            '/premium': 'premium',
          };
          const flagKey = routeToFlag[it.to];
          if (flagKey && settings.featurePages && settings.featurePages[flagKey] === false) {
            return null;
          }
          return (
            <NavLink
              key={it.to}
              to={it.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground border border-sidebar-border"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                )
              }
            >
              <it.icon className="w-4 h-4" />
              {it.label}
            </NavLink>
          );
        })}
      </nav>
      <div className="px-3 py-3 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-9 h-9 rounded-full gradient-accent flex items-center justify-center text-accent-foreground font-bold text-sm">
            {user?.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <Badge variant={user?.role === "premium" ? "accent" : "muted"} className="text-[10px]">
              {user?.role === "premium" ? "Premium" : user?.role === "admin" ? "Admin" : "Free"}
            </Badge>
          </div>
          <button
            onClick={() => { logout(); navigate("/"); }}
            className="p-2 rounded-md hover:bg-sidebar-accent/60"
            aria-label="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
