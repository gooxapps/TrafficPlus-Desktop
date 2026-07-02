import { Link } from "react-router-dom";
import { Zap } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";

export function Footer() {
  const { settings } = useSiteSettings();
  const cols = [
    { title: "Product", links: [["Features", "/#features"], ["Pricing", "/premium"], ["Surf", "/surf"], ["Campaigns", "/campaigns"]] },
    { title: "Company", links: [["About", "/#"], ["Blog", "/#"], ["Contact", "/#"], ["Careers", "/#"]] },
    { title: "Legal", links: [["Terms", "/#"], ["Privacy", "/#"], ["Cookie Policy", "/#"], ["Acceptable Use", "/#"]] },
  ];
  return (
    <footer className="border-t border-border bg-card/30">
      <div className="container py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              {settings.siteLogo ? (
                <img src={settings.siteLogo} alt={settings.siteName} className="w-8 h-8 rounded-lg object-contain" />
              ) : (
                <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                  <Zap className="w-4 h-4 text-primary-foreground" />
                </div>
              )}
              <span className="font-bold">{settings.siteName}</span>
            </Link>
            <p className="text-sm text-muted-foreground max-w-xs">
              {settings.footerText}
            </p>
          </div>
          {cols.map((c) => (
            <div key={c.title}>
              <h4 className="font-semibold text-sm mb-3">{c.title}</h4>
              <ul className="space-y-2">
                {c.links.map(([label, href]) => (
                  <li key={label}>
                    <a href={href} className="text-sm text-muted-foreground hover:text-foreground">{label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 pt-6 border-t border-border flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>{settings.copyrightText}</p>
          <p>Built for serious marketers.</p>
        </div>
      </div>
    </footer>
  );
}
