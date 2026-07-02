import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PRICING } from "@/lib/mock-data";
import { useAuth } from "@/hooks/useAuth";
import { addActivity } from "@/lib/storage";
import { toast } from "@/hooks/useToast";
import { Check, Crown, Sparkles, Zap } from "lucide-react";
import { useSiteSettings } from '@/hooks/useSiteSettings';
import ComingSoon from '@/components/ui/ComingSoon';

export default function Premium() {
  const { user, upgrade, updateCredits } = useAuth();

  const { settings } = useSiteSettings();

  if (settings.featurePages && settings.featurePages.premium === false) {
    return <ComingSoon />;
  }

  const subscribe = async (plan: typeof PRICING[number]) => {
    await upgrade("premium");
    await updateCredits(plan.credits);
    void addActivity({
      type: "purchase",
      amount: plan.credits,
      description: `${plan.name} subscription — ${plan.credits.toLocaleString()} credits included`,
    });
    toast({ title: "Welcome to Premium!", description: `${plan.name} plan activated (mock).`, variant: "success" });
  };

  return (
    <DashboardLayout title="Premium" subtitle="Unlock 2-3× faster credit earnings and pro features.">
      <div className="text-center max-w-2xl mx-auto mb-10">
        <Crown className="w-10 h-10 text-accent mx-auto mb-3" />
        <h2 className="text-3xl font-bold tracking-tight">Choose the plan that fits your growth</h2>
        <p className="text-muted-foreground mt-3">
          All plans include unlimited surfing, anti-bot protection, and our entire feature set. Cancel anytime.
        </p>
        {user?.role === "premium" && (
          <Badge variant="accent" className="mt-4 px-3 py-1">
            <Sparkles className="w-3 h-3" /> You're on Premium
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
        {PRICING.map((p) => (
          <Card
            key={p.id}
            className={`p-7 relative ${p.popular ? "border-primary/40 bg-gradient-to-b from-primary/10 to-transparent shadow-xl glow-primary" : ""}`}
          >
            {p.popular && (
              <Badge variant="primary" className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1">
                <Zap className="w-3 h-3" /> Most popular
              </Badge>
            )}
            <h3 className="font-semibold text-lg">{p.name}</h3>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-4xl font-bold tracking-tight">${p.price}</span>
              <span className="text-muted-foreground">/{p.period}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{p.credits.toLocaleString()} credits included</p>
            <Button
              className="w-full mt-5"
              variant={p.popular ? "primary" : "outline"}
              onClick={() => subscribe(p)}
            >
              {user?.role === "premium" ? "Switch plan" : "Choose " + p.name}
            </Button>
            <ul className="mt-6 space-y-2.5">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      <Card className="mt-10 p-7 max-w-5xl mx-auto">
        <h3 className="font-semibold text-lg mb-5">Compare features</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground text-xs border-b border-border">
              <tr><th className="py-3">Feature</th><th>Free</th><th>Weekly</th><th>Monthly</th><th>Annual</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                ["Surf reward multiplier", "1×", "1.5×", "2×", "3×"],
                ["Concurrent surf windows", "4", "4", "4", "4"],
                ["Active campaigns", "5", "5", "25", "Unlimited"],
                ["Country targeting", "3", "All", "All", "All"],
                ["Device targeting", "—", "—", "✓", "✓"],
                ["Ad-free surfing", "—", "—", "✓", "✓"],
                ["Pro analytics", "—", "—", "—", "✓"],
              ].map((row) => (
                <tr key={row[0]}>
                  {row.map((cell, i) => (
                    <td key={i} className={`py-3 ${i === 0 ? "font-medium" : ""}`}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </DashboardLayout>
  );
}
