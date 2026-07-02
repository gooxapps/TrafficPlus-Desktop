import { Link, useNavigate } from "react-router-dom";
import { PublicNavbar } from "@/components/layout/PublicNavbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  ArrowRight, Globe, Coins, Target, Shield, BarChart3, Users,
  Zap, Sparkles, CheckCircle2, MousePointerClick, Crown
} from "lucide-react";
import heroImg from "@/assets/hero-globe.jpg";
import { useSiteSettings } from "@/hooks/useSiteSettings";

// Helper to map icon names to actual components
const iconMap: Record<string, any> = {
  globe: Globe,
  shield: Shield,
  zap: Zap,
  target: Target,
  coins: Coins,
  "bar-chart-3": BarChart3,
  users: Users,
  sparkles: Sparkles,
  "check-circle-2": CheckCircle2,
  "mouse-pointer-click": MousePointerClick,
  crown: Crown,
  "arrow-right": ArrowRight
};

export default function Landing() {
  const navigate = useNavigate();
  const { settings } = useSiteSettings();

  // Map features to use icons from our iconMap
  const features = settings.features.map(f => ({
    icon: iconMap[f.icon] || Globe,
    title: f.title,
    desc: f.description
  }));
  const steps = [
    { n: 1, title: "Sign up free", desc: "Create your account and get 250 starter credits instantly." },
    { n: 2, title: "Surf or submit", desc: "Earn credits by surfing or submit your URL for instant approval." },
    { n: 3, title: "Watch traffic flow", desc: "Real visitors land on your campaign — analyzed in real time." },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <PublicNavbar />

      {/* Hero */}
      <section className="relative gradient-hero overflow-hidden">
        <div className="absolute inset-0 grid-pattern opacity-40 pointer-events-none" />
        <div className="container relative py-20 lg:py-28">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge variant="primary" className="mb-5 px-3 py-1">
                <Sparkles className="w-3 h-3" /> Trusted by 50,000+ marketers
              </Badge>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05]">
                {settings.heroTitle}
              </h1>
              <p className="mt-6 text-lg text-muted-foreground max-w-xl">
                {settings.heroSubtitle}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button size="lg" onClick={() => navigate("/signup")}> 
                  {settings.heroButtonText} <ArrowRight className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="lg" onClick={() => navigate("/premium")}>
                  {settings.heroSecondaryButtonText}
                </Button>
              </div>
              <div className="mt-8 flex items-center gap-6 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-primary" /> No credit card</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-primary" /> 250 free credits</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-primary" /> Cancel anytime</span>
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 -z-10 blur-3xl rounded-full bg-primary/20 float-slow" />
              <img src={heroImg} alt="TrafficPlus global network" className="rounded-2xl shadow-2xl border border-border" />
              <Card className="absolute -bottom-6 -left-4 sm:-left-8 p-4 shadow-2xl backdrop-blur bg-card/80 hidden sm:block">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center"><MousePointerClick className="w-5 h-5 text-primary-foreground" /></div>
                  <div>
                    <p className="text-xs text-muted-foreground">Live visitors right now</p>
                    <p className="font-bold text-lg">12,847 <span className="text-primary text-xs">▲ 8.2%</span></p>
                  </div>
                </div>
              </Card>
              <Card className="absolute -top-4 -right-2 sm:-right-6 p-4 shadow-2xl backdrop-blur bg-card/80 hidden sm:block">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg gradient-accent flex items-center justify-center"><Coins className="w-5 h-5 text-accent-foreground" /></div>
                  <div>
                    <p className="text-xs text-muted-foreground">Credits earned today</p>
                    <p className="font-bold text-lg">+2,485</p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-y border-border bg-card/40">
        <div className="container py-10 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            ["50K+", "Active marketers"],
            ["12M+", "Daily page views"],
            ["180+", "Countries reached"],
            ["99.2%", "Bot-blocked traffic"],
          ].map(([v, l]) => (
            <div key={l} className="text-center">
              <p className="text-3xl font-bold tracking-tight">{v}</p>
              <p className="text-xs text-muted-foreground mt-1">{l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="container py-20 lg:py-28">
        <div className="max-w-2xl mx-auto text-center mb-14">
          <Badge variant="primary" className="mb-4">Why TrafficPlus</Badge>
          <h2 className="text-3xl lg:text-4xl font-bold tracking-tight">Everything a growth marketer needs</h2>
          <p className="text-muted-foreground mt-4">
            Built from the ground up with anti-fraud, advanced targeting, and a beautiful command center.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <Card key={f.title} className={i === 0 ? "p-7 lg:row-span-2 lg:col-span-1 bg-gradient-to-br from-primary/10 to-transparent border-primary/30" : "p-6"}>
              <div className={`w-11 h-11 rounded-lg flex items-center justify-center mb-4 ${i === 0 ? "gradient-primary glow-primary" : "bg-primary/10 text-primary"}`}>
                <f.icon className={`w-5 h-5 ${i === 0 ? "text-primary-foreground" : ""}`} />
              </div>
              <h3 className="font-semibold text-lg mb-1.5">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="bg-card/40 border-y border-border">
        <div className="container py-20 lg:py-24">
          <div className="max-w-2xl mx-auto text-center mb-14">
            <Badge variant="accent" className="mb-4">How it works</Badge>
            <h2 className="text-3xl lg:text-4xl font-bold tracking-tight">From signup to traffic in 60 seconds</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {steps.map((s) => (
              <Card key={s.n} className="p-7 relative overflow-hidden">
                <div className="absolute top-4 right-4 text-7xl font-black text-primary/10 leading-none">{s.n}</div>
                <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center mb-4">
                  <Zap className="w-5 h-5 text-primary-foreground" />
                </div>
                <h3 className="font-semibold text-lg">{s.title}</h3>
                <p className="text-sm text-muted-foreground mt-2">{s.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container py-20 lg:py-24">
        <Card className="relative overflow-hidden p-10 lg:p-16 text-center gradient-hero border-primary/20">
          <div className="absolute inset-0 grid-pattern opacity-30 pointer-events-none" />
          <Crown className="w-10 h-10 text-accent mx-auto mb-4" />
          <h2 className="text-3xl lg:text-4xl font-bold tracking-tight max-w-2xl mx-auto">
            Stop guessing. Start sending real visitors today.
          </h2>
          <p className="text-muted-foreground mt-4 max-w-lg mx-auto">
            Join thousands of marketers using TrafficPlus to grow their campaigns ethically.
          </p>
          <div className="mt-7 flex flex-wrap gap-3 justify-center">
            <Button size="lg" onClick={() => navigate("/signup")}>
              Create free account <ArrowRight className="w-4 h-4" />
            </Button>
            <Link to="/premium"><Button variant="outline" size="lg">Compare plans</Button></Link>
          </div>
        </Card>
      </section>

      {/* FAQ */}
      <section id="faq" className="container pb-20">
        <h2 className="text-2xl font-bold mb-8 text-center">Frequently asked</h2>
        <div className="max-w-3xl mx-auto space-y-3">
          {[
            ["Is the traffic real human visitors?", "Yes. Every visit comes from a verified TrafficPlus user surfing on our platform. Our anti-bot engine blocks automation and proxies."],
            ["How fast will I earn 1,000 credits?", "On average, active surfers earn 1,000 credits in 30–45 minutes. Premium members earn 2-3× faster."],
            ["Can I target specific countries?", "Yes. Free users can target up to 3 countries; Premium plans unlock all 180+ countries with device targeting."],
            ["Will my campaign be approved?", "Most campaigns are approved within minutes. We reject adult, illegal, malware, or auto-redirect content."],
          ].map(([q, a]) => (
            <Card key={q} className="p-5">
              <h3 className="font-semibold">{q}</h3>
              <p className="text-sm text-muted-foreground mt-2">{a}</p>
            </Card>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  );
}
