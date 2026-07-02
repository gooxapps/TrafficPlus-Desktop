import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/features/ThemeToggle";
import { Zap, Menu } from "lucide-react";
import { useState } from "react";
import { useSiteSettings } from "@/hooks/useSiteSettings";

export function PublicNavbar() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { settings } = useSiteSettings();
  const authEnabled = settings?.authRequired === true;
  const links = [
    { to: "/#features", label: "Features" },
    { to: "/#how", label: "How it works" },
    { to: "/premium", label: "Pricing" },
    { to: "/#faq", label: "FAQ" },
  ];
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 backdrop-blur-md bg-background/70">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          {settings.siteLogo ? (
            <img src={settings.siteLogo} alt={settings.siteName} className="w-9 h-9 rounded-lg object-contain" />
          ) : (
            <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center glow-primary">
              <Zap className="w-5 h-5 text-primary-foreground" />
            </div>
          )}
          <span className="font-bold text-lg tracking-tight">{settings.siteName}</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <a key={l.to} href={l.to} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" size="sm" onClick={() => navigate("/login")} className="hidden sm:inline-flex">
            Sign in
          </Button>
          <Button size="sm" onClick={() => navigate("/signup")}> 
            Get started
          </Button>
          {authEnabled === false && (
            <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>Open app</Button>
          )}
          <button className="md:hidden ml-1 p-2" onClick={() => setOpen((v) => !v)}>
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>
      {open && (
        <div className="md:hidden border-t border-border bg-background">
          <div className="container py-3 flex flex-col gap-3">
            {links.map((l) => (
              <a key={l.to} href={l.to} className="text-sm text-muted-foreground hover:text-foreground">{l.label}</a>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
