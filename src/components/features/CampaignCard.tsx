import type { Campaign } from "@/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Progress } from "@/components/ui/Progress";
import { ExternalLink, Pause, Play, Trash2, Globe, Settings } from "lucide-react";
import { formatNumber } from "@/lib/utils";

const statusVariant: Record<Campaign["status"], "success" | "warning" | "primary" | "danger"> = {
  active: "success", paused: "warning", pending: "primary", rejected: "danger",
};

export function CampaignCard({
  campaign, onToggle, onDelete, onManage,
}: {
  campaign: Campaign;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onManage: (campaign: Campaign) => void;
}) {
  const pct = Math.min(100, (campaign.creditsUsed / campaign.creditsAllocated) * 100);
  return (
    <Card className="p-5 hover:border-primary/30 transition-colors">
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
          <Globe className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-semibold truncate">{campaign.title}</h3>
              <a href={campaign.url} className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1">
                {campaign.url} <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="flex items-center gap-2">
              {campaign.id?.startsWith('demo-') && <Badge variant="primary">Demo</Badge>}
              <Badge variant="muted">{campaign.mode === "search" ? "Search" : "Direct"}</Badge>
              <Badge variant={statusVariant[campaign.status]}>{campaign.status}</Badge>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
            <div>
              <p className="text-muted-foreground">Visits</p>
              <p className="font-bold text-base">{formatNumber(campaign.visitsReceived)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Daily limit</p>
              <p className="font-bold text-base">{formatNumber(campaign.dailyLimit)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <Button
              variant="outline" size="sm"
              onClick={() => onToggle(campaign.id)}
              disabled={campaign.status === "pending" || campaign.status === "rejected"}
            >
              {campaign.status === "active" ? <><Pause className="w-3.5 h-3.5" /> Pause</> : <><Play className="w-3.5 h-3.5" /> Resume</>}
            </Button>
            <Button
              variant="outline" size="sm"
              onClick={() => onManage(campaign)}
            >
              <Settings className="w-3.5 h-3.5" /> Manage
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onDelete(campaign.id)} className="text-red-500 hover:text-red-500 hover:bg-red-500/10 ml-auto">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
