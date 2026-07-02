import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { CREDIT_PACKS } from "@/lib/mock-data";
import { useAuth } from "@/hooks/useAuth";
import { useStoredAsync } from "@/hooks/useStoredAsync";
import { addActivity, getActivities } from "@/lib/storage";
import { toast } from "@/hooks/useToast";
import { Coins, Gift, ShoppingBag, Trophy, Zap, Inbox } from "lucide-react";
import { formatNumber, timeAgo } from "@/lib/utils";
import type { Activity } from "@/types";
import { useSiteSettings } from '@/hooks/useSiteSettings';
import ComingSoon from '@/components/ui/ComingSoon';

export default function Credits() {
  const { user, updateCredits } = useAuth();
  const activities = useStoredAsync<Activity[]>(getActivities, []);

  const { settings } = useSiteSettings();

  if (settings.featurePages && settings.featurePages.credits === false) {
    return <ComingSoon />;
  }

  const totalEarned = activities.filter((a) => a.amount > 0).reduce((s, a) => s + a.amount, 0);

  const buyPack = async (credits: number, price: number) => {
    await updateCredits(credits);
    void addActivity({
      type: "purchase",
      amount: credits,
      description: `Purchased ${formatNumber(credits)} credit pack ($${price})`,
    });
    toast({ title: `+${formatNumber(credits)} credits added`, description: "Mock purchase complete.", variant: "success" });
  };

  const claimDaily = async () => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const claimed = activities.some(
      (a) => a.type === "bonus" && a.description.includes("Daily") && new Date(a.timestamp) >= today
    );
    if (claimed) {
      toast({ title: "Already claimed today", description: "Come back tomorrow.", variant: "default" });
      return;
    }
    await updateCredits(50);
    void addActivity({
      type: "bonus",
      amount: 50,
      description: "Daily login bonus",
    });
    toast({ title: "Daily bonus claimed", description: "+50 credits added.", variant: "success" });
  };

  const claimAchievement = async (name: string, reward: number) => {
    await updateCredits(reward);
    void addActivity({
      type: "bonus",
      amount: reward,
      description: `Claimed achievement: ${name}`,
    });
    toast({ title: "Achievement claimed!", description: `+${reward} credits added.`, variant: "success" });
  };

  return (
    <DashboardLayout title="Credits" subtitle="Buy, earn, and track every credit movement.">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="lg:col-span-2 p-7 bg-gradient-to-br from-primary/15 via-card to-accent/10 border-primary/20 relative overflow-hidden">
          <div className="absolute -bottom-10 -right-10 w-48 h-48 rounded-full bg-primary/15 blur-3xl" />
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Credit balance</p>
          <p className="text-5xl font-bold mt-2 tracking-tight flex items-center gap-2">
            <Coins className="w-9 h-9 text-accent" /> {user?.credits.toLocaleString() ?? 0}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            ≈ {formatNumber(user?.credits ?? 0)} targeted visits • {formatNumber(totalEarned)} lifetime earned
          </p>
          <div className="flex flex-wrap gap-2 mt-5">
            <Button onClick={() => document.getElementById("packs")?.scrollIntoView({ behavior: "smooth" })}>
              <ShoppingBag className="w-4 h-4" /> Buy credits
            </Button>
            <Button variant="outline" onClick={claimDaily}><Gift className="w-4 h-4" /> Claim daily +50</Button>
          </div>
        </Card>
        <Card className="p-6">
          <Trophy className="w-7 h-7 text-accent mb-2" />
          <CardTitle>Achievements</CardTitle>
          <CardDescription className="mt-1">Earn bonus credits by hitting milestones.</CardDescription>
          <div className="mt-4 space-y-3">
            {[
              { t: "First surf complete", r: 50, done: activities.some((a) => a.type === "earn") },
              { t: "Earn 1,000 credits", r: 200, done: totalEarned >= 1000 },
              { t: "Earn 10,000 credits", r: 1000, done: totalEarned >= 10000 },
              { t: "Claim daily bonus", r: 25, done: activities.some((a) => a.type === "bonus") },
            ].map(({ t, r, done }) => {
              const claimed = activities.some(
                (a) => a.type === "bonus" && a.description === `Claimed achievement: ${t}`
              );
              return (
                <div key={t} className="flex items-center justify-between text-sm gap-2">
                  <span className={done ? "text-foreground" : "text-muted-foreground"}>{t}</span>
                  {claimed ? (
                    <Badge variant="success">✓ Claimed</Badge>
                  ) : done ? (
                    <Button
                      size="sm"
                      className="h-7 px-2.5 text-[11px] font-bold"
                      onClick={() => claimAchievement(t, r)}
                    >
                      Claim +{r}
                    </Button>
                  ) : (
                    <Badge variant="muted">+{r}</Badge>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <h2 id="packs" className="text-lg font-semibold mb-3">Credit packs</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {CREDIT_PACKS.map((p) => (
          <Card key={p.id} className="p-5 hover:border-primary/40 transition-colors relative">
            {p.badge && <Badge variant="accent" className="absolute -top-2 left-5">{p.badge}</Badge>}
            <Coins className="w-7 h-7 text-accent" />
            <p className="text-2xl font-bold mt-3">{formatNumber(p.credits)}</p>
            <p className="text-xs text-muted-foreground">credits</p>
            <p className="mt-3 text-3xl font-bold">${p.price}</p>
            <Button className="w-full mt-4" onClick={() => buyPack(p.credits, p.price)}>Purchase</Button>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Credit history</CardTitle>
          <CardDescription>All earnings, spends, and purchases</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {activities.length === 0 ? (
            <div className="py-12 text-center">
              <Inbox className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm font-medium">No activity yet</p>
              <p className="text-xs text-muted-foreground mt-1">Surf websites or claim your daily bonus to see history.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {activities.map((a) => (
                <div key={a.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center"><Zap className="w-4 h-4" /></div>
                    <div>
                      <p className="text-sm font-medium">{a.description}</p>
                      <p className="text-xs text-muted-foreground capitalize">{a.type} • {timeAgo(a.timestamp)}</p>
                    </div>
                  </div>
                  <span className={`font-bold ${a.amount > 0 ? "text-primary" : "text-accent"}`}>
                    {a.amount > 0 ? "+" : ""}{a.amount.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
