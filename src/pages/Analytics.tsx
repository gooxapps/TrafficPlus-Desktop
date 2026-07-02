import { useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { ActivityChart } from "@/components/features/ActivityChart";
import { useStoredAsync } from "@/hooks/useStoredAsync";
import { getCampaigns, getDailyActivity, getActivities } from "@/lib/storage";
import { Globe, BarChart3, Inbox, Megaphone, Loader2 } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { StatCard } from "@/components/features/StatCard";
import { useAuth } from "@/hooks/useAuth";
import { getRecentVisitors, getLiveVisitorCount, getTopCountries } from "@/lib/storage";
import type { Activity, Campaign } from "@/types";

export default function Analytics() {
  const { user } = useAuth();
  const allCampaigns = useStoredAsync<Campaign[]>(getCampaigns, []);
  const campaigns = useMemo(
    () => allCampaigns.filter((c) => c.ownerId === user?.id),
    [allCampaigns, user?.id]
  );
  const activities = useStoredAsync<Activity[]>(getActivities, []);
  const daily = useStoredAsync<{ date: string; earned: number; spent: number }[]>(getDailyActivity, []);

  const totalVisits = campaigns.reduce((s, c) => s + c.visitsReceived, 0);
  const totalEarned = activities.filter((a) => a.amount > 0).reduce((s, a) => s + a.amount, 0);
  const totalSpent = Math.abs(activities.filter((a) => a.amount < 0).reduce((s, a) => s + a.amount, 0));
  const activeCount = campaigns.filter((c) => c.status === "active").length;
  const topCampaigns = [...campaigns].sort((a, b) => b.visitsReceived - a.visitsReceived).slice(0, 5);
  const liveCount = useStoredAsync<number>(() => getLiveVisitorCount(5), 0);
  const recentVisitors = useStoredAsync(getRecentVisitors, []);
  const topCountries = useStoredAsync(getTopCountries, []);

  return (
    <DashboardLayout title="Analytics" subtitle="Deep insight into your campaigns and visitors.">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total visits" value={totalVisits} icon={Globe} accent="primary" />
        <StatCard label="Live visitors" value={liveCount} icon={Loader2} accent="accent" />
        <StatCard label="Credits earned" value={totalEarned} icon={BarChart3} accent="accent" />
        <StatCard label="Credits spent" value={totalSpent} icon={BarChart3} accent="info" />
        <StatCard label="Active campaigns" value={activeCount} icon={Megaphone} accent="primary" />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Traffic over time</CardTitle>
          <CardDescription>Last 7 days of credits earned vs. spent</CardDescription>
        </CardHeader>
        <CardContent className="pl-2">
          {activities.length === 0 ? (
            <div className="py-12 text-center">
              <Inbox className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm font-medium">No data yet</p>
              <p className="text-xs text-muted-foreground mt-1">Start surfing or running campaigns to see your traffic trends.</p>
            </div>
          ) : (
            <ActivityChart data={daily.map((item) => ({ day: item.date, earned: item.earned, spent: item.spent }))} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top campaigns by visits</CardTitle>
          <CardDescription>Where your traffic is going</CardDescription>
        </CardHeader>
        <CardContent>
          {topCampaigns.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No campaigns yet — add one to start seeing data.
            </div>
          ) : (
            <div className="space-y-3">
              {topCampaigns.map((c) => {
                const pct = totalVisits > 0 ? (c.visitsReceived / totalVisits) * 100 : 0;
                return (
                  <div key={c.id}>
                    <div className="flex items-center justify-between text-sm mb-1.5 gap-3">
                      <span className="flex items-center gap-2 truncate min-w-0">
                        <Globe className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="truncate">{c.title}</span>
                      </span>
                      <span className="font-medium flex-shrink-0">
                        {formatNumber(c.visitsReceived)}{" "}
                        <span className="text-muted-foreground text-xs">({pct.toFixed(1)}%)</span>
                      </span>
                    </div>
                    <div className="h-2 rounded bg-muted overflow-hidden">
                      <div className="h-full gradient-primary" style={{ width: `${Math.max(2, pct)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent visitors</CardTitle>
            <CardDescription>Latest page views across your campaigns</CardDescription>
          </CardHeader>
          <CardContent>
            {recentVisitors.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">No visitors recorded yet.</div>
            ) : (
              <div className="space-y-2">
                {recentVisitors.slice(0, 20).map((v: any) => (
                  <div key={v.id} className="flex items-center justify-between text-sm">
                    <div className="truncate">
                      <div className="font-medium">{v.campaignId ?? '—'}</div>
                      <div className="text-muted-foreground text-xs truncate">{v.country ?? 'Unknown'} • {v.deviceType ?? v.browser ?? '—'}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">{new Date(v.createdAt).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top countries</CardTitle>
            <CardDescription>Where your visitors come from</CardDescription>
          </CardHeader>
          <CardContent>
            {topCountries.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">No geo data yet.</div>
            ) : (
              <div className="space-y-2">
                {topCountries.map((c: any) => (
                  <div key={c.country} className="flex items-center justify-between text-sm">
                    <div className="truncate">{c.country}</div>
                    <div className="font-medium">{c.count}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
