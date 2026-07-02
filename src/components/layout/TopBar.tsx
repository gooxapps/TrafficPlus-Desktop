import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/features/ThemeToggle";
import { Bell, Coins, Search, Menu, X, Zap, LayoutDashboard, Globe, Megaphone, BarChart3, Crown, Settings as SettingsIcon } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatNumber } from "@/lib/utils";
import { Link, NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useSiteSettings } from "@/hooks/useSiteSettings";

const mobileNavItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/surf", label: "Surf & Earn", icon: Globe },
  { to: "/campaigns", label: "Campaigns", icon: Megaphone },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/premium", label: "Premium", icon: Crown },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export function TopBar({ title, subtitle }: { title: string; subtitle?: string }) {
  const { user } = useAuth();
  const { settings } = useSiteSettings();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-30 h-16 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="h-full px-4 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <button
              className="lg:hidden h-10 w-10 inline-flex items-center justify-center rounded-lg border border-border bg-card hover:bg-muted"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            <Link to="/dashboard" className="flex items-center gap-2 lg:hidden">
              {settings.siteLogo ? (
                <img src={settings.siteLogo} alt={settings.siteName} className="w-8 h-8 rounded-lg object-contain" />
              ) : (
                <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                  <Zap className="w-4 h-4 text-primary-foreground" />
                </div>
              )}
              <span className="font-bold tracking-tight text-sm">{settings.siteName}</span>
            </Link>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold tracking-tight truncate">{title}</h1>
              {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2 h-10 px-3 rounded-lg bg-muted/50 border border-border w-64">
              <Search className="w-4 h-4 text-muted-foreground" />
              <input className="bg-transparent flex-1 text-sm outline-none" placeholder="Search…" />
            </div>
            <Link
              to="/credits"
              className="flex items-center gap-2 h-10 px-3 rounded-lg border border-border bg-card hover:bg-muted transition-colors"
            >
              <Coins className="w-4 h-4 text-accent" />
              <span className="text-sm font-bold">{formatNumber(user?.credits ?? 0)}</span>
              <Badge variant="primary" className="hidden sm:inline-flex">credits</Badge>
            </Link>
            <button className="h-10 w-10 inline-flex items-center justify-center rounded-lg border border-border bg-card hover:bg-muted relative">
              <Bell className="w-4 h-4" />
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-accent pulse-dot" />
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-64 bg-background border-l border-border shadow-xl">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
              {settings.siteLogo ? (
                <img src={settings.siteLogo} alt={settings.siteName} className="w-8 h-8 rounded-lg object-contain" />
              ) : (
                <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                  <Zap className="w-4 h-4 text-primary-foreground" />
                </div>
              )}
              <span className="font-bold tracking-tight">{settings.siteName}</span>
            </div>
              <button onClick={() => setMobileMenuOpen(false)} className="h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-muted">
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="p-4 space-y-2">
              {mobileNavItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    )
                  }
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border">
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
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
