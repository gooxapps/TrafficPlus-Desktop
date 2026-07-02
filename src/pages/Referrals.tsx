import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/hooks/useAuth";
import { useStoredAsync } from "@/hooks/useStoredAsync";
import { getReferrals } from "@/lib/storage";
import { toast } from "@/hooks/useToast";
import { Copy, Users, Coins, TrendingUp, Share2, Inbox } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { StatCard } from "@/components/features/StatCard";
import type { Referral } from "@/types";
import { useSiteSettings } from '@/hooks/useSiteSettings';
import ComingSoon from '@/components/ui/ComingSoon';

export default function Referrals() {
  const { user } = useAuth();
  const referrals = useStoredAsync<Referral[]>(getReferrals, []);
  const link = `${window.location.origin}/signup?ref=${user?.referralCode ?? "DEMO"}`;
  const total = referrals.reduce((s, r) => s + r.earnings, 0);
  const active = referrals.filter((r) => r.status === "active").length;

  const { settings } = useSiteSettings();

  if (settings.featurePages && settings.featurePages.referrals === false) {
    return <ComingSoon />;
  }

  const copy = () => {
    navigator.clipboard.writeText(link);
    toast({ title: "Link copied", description: "Share with your audience.", variant: "success" });
  };

  return (
    <DashboardLayout title="Referrals" subtitle="Earn lifetime commissions on direct and indirect referrals.">
      <Card className="p-7 bg-gradient-to-br from-accent/15 via-card to-primary/10 border-accent/20 mb-6 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-accent/20 blur-3xl" />
        <Share2 className="w-7 h-7 text-accent mb-3" />
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Your unique referral link</p>
        <div className="mt-3 flex flex-col sm:flex-row gap-2">
          <Input readOnly value={link} className="font-mono text-sm" />
          <Button onClick={copy}><Copy className="w-4 h-4" /> Copy link</Button>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-4 max-w-md text-sm">
          <div><p className="text-muted-foreground text-xs">Tier 1</p><p className="font-bold">25% lifetime</p></div>
          <div><p className="text-muted-foreground text-xs">Tier 2</p><p className="font-bold">10% lifetime</p></div>
          <div><p className="text-muted-foreground text-xs">Min payout</p><p className="font-bold">$25</p></div>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total referrals" value={referrals.length} icon={Users} accent="primary" />
        <StatCard label="Active referrals" value={active} icon={TrendingUp} accent="accent" />
        <StatCard label="Lifetime earnings" value={total} icon={Coins} accent="primary" />
        <StatCard label="Pending payout" value={0} icon={TrendingUp} accent="info" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Referred users</CardTitle>
          <CardDescription>Track every referral and earnings</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {referrals.length === 0 ? (
            <div className="py-12 text-center">
              <Inbox className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm font-medium">No referrals yet</p>
              <p className="text-xs text-muted-foreground mt-1">Share your unique link above to start earning lifetime commissions.</p>
              <Button size="sm" className="mt-3" onClick={copy}><Copy className="w-3.5 h-3.5" /> Copy link</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground border-b border-border">
                  <tr><th className="py-3">Email</th><th>Joined</th><th>Tier</th><th>Status</th><th className="text-right">Earnings</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {referrals.map((r) => (
                    <tr key={r.id}>
                      <td className="py-3 font-medium">{r.email}</td>
                      <td className="text-muted-foreground">{formatDate(r.joinedAt)}</td>
                      <td><Badge variant="muted">Tier {r.level}</Badge></td>
                      <td><Badge variant={r.status === "active" ? "success" : "muted"}>{r.status}</Badge></td>
                      <td className="text-right font-bold text-primary">+{r.earnings} cr</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
