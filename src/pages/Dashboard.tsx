import { useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatCard } from "@/components/features/StatCard";
import { ActivityChart } from "@/components/features/ActivityChart";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { Coins, Megaphone, Globe, Users, Sparkles, ArrowRight, Zap, Inbox } from "lucide-react";
import { Link } from "react-router-dom";
import { timeAgo } from "@/lib/utils";
import { useStoredAsync } from "@/hooks/useStoredAsync";
import { getActivities, getCampaigns, getDailyActivity, getReferrals, getTodayEarned } from "@/lib/storage";
import type { Activity, Campaign, Referral } from "@/types";

const typeStyle: Record<string, { color: string; label: string }> = {
  earn: { color: "text-primary", label: "Earned" },
  spend: { color: "text-accent", label: "Spent" },
  bonus: { color: "text-emerald-500", label: "Bonus" },
  referral: { color: "text-sky-500", label: "Referral" },
  purchase: { color: "text-purple-500", label: "Purchase" },
};

export default function Dashboard() {
  const { user } = useAuth();
  const allCampaigns = useStoredAsync<Campaign[]>(getCampaigns, []);
  const ownCampaigns = useMemo(
    () => allCampaigns.filter((c) => c.ownerId === user?.id),
    [allCampaigns, user?.id]
  );
  const activities = useStoredAsync<Activity[]>(getActivities, []);
  const referrals = useStoredAsync<Referral[]>(getReferrals, []);
  const daily = useStoredAsync<{ date: string; earned: number; spent: number }[]>(getDailyActivity, []);
  const todayEarned = useStoredAsync<number>(getTodayEarned, 0);

  const activeCampaigns = ownCampaigns.filter((c) => c.status === "active").length;
  const trafficReceived = ownCampaigns.reduce((s, c) => s + c.visitsReceived, 0);
  const referralEarnings = referrals.reduce((s, r) => s + r.earnings, 0);
  const dailyGoal = 500;
  const goalPct = Math.min(100, (todayEarned / dailyGoal) * 100);
  const remainingForGoal = Math.max(0, dailyGoal - todayEarned);

  return (
    <DashboardLayout title={`Welcome back, ${user?.name.split(" ")[0] ?? "there"}`} subtitle="Here's what's happening with your traffic today.">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total credits" value={user?.credits ?? 0} icon={Coins} accent="primary" />
        <StatCard label="Active campaigns" value={activeCampaigns} icon={Megaphone} accent="accent" />
        <StatCard label="Traffic received" value={trafficReceived} icon={Globe} accent="info" />
        <StatCard label="Referral earnings" value={referralEarnings} icon={Users} accent="primary" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>Daily activity</CardTitle>
                <CardDescription>Credits earned vs. spent over the past 7 days</CardDescription>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary" /> Earned</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-accent" /> Spent</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pl-2">
            <ActivityChart data={daily.map((item) => ({ day: item.date, earned: item.earned, spent: item.spent }))} />
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-primary/10 via-card to-accent/5 border-primary/20">
          <CardHeader>
            <Sparkles className="w-6 h-6 text-accent mb-2" />
            <CardTitle>Boost with Premium</CardTitle>
            <CardDescription>2× faster credit earnings, advanced targeting, and unlimited campaigns.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Surf reward boost</span><span className="font-medium">2×</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Country targeting</span><span className="font-medium">All 180+</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Active campaigns</span><span className="font-medium">25</span></div>
            </div>
            <Link to="/premium"><Button className="w-full mt-5">Upgrade now <ArrowRight className="w-4 h-4" /></Button></Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>Recent activity</CardTitle>
                <CardDescription>Your latest credit movements</CardDescription>
              </div>
              <Link to="/credits"><Button variant="ghost" size="sm">View all</Button></Link>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {activities.length === 0 ? (
              <div className="py-12 text-center">
                <Inbox className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-sm font-medium">No activity yet</p>
                <p className="text-xs text-muted-foreground mt-1">Start surfing to earn your first credits.</p>
                <Link to="/surf"><Button size="sm" className="mt-3"><Globe className="w-3.5 h-3.5" /> Start surfing</Button></Link>
              </div>
            ) : (
              <div className="space-y-1">
                {activities.slice(0, 6).map((a) => (
                  <div key={a.id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${typeStyle[a.type]?.color || "text-primary"} bg-current/10`}>
                        <Zap className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{a.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {timeAgo(a.timestamp)} • <Badge variant="muted" className="text-[10px]">{typeStyle[a.type]?.label || a.type}</Badge>
                        </p>
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

        <Card>
          <CardHeader>
            <CardTitle>Daily goal</CardTitle>
            <CardDescription>Earn {dailyGoal} credits today.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-2">
              <div className="relative w-32 h-32 mx-auto">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="44" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
                  <circle cx="50" cy="50" r="44" fill="none" stroke="hsl(158 84% 45%)" strokeWidth="8" strokeDasharray={`${(goalPct / 100) * 2 * Math.PI * 44} ${2 * Math.PI * 44}`} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-2xl font-bold">{todayEarned}</p>
                  <p className="text-xs text-muted-foreground">/ {dailyGoal}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-3">
                {remainingForGoal === 0 ? "Goal reached!" : `${remainingForGoal} credits to go`}
              </p>
              <Link to="/surf"><Button className="w-full mt-4"><Globe className="w-4 h-4" /> Surf now</Button></Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
