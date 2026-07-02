import { Card } from "@/components/ui/Card";
import { cn, formatNumber } from "@/lib/utils";
import { LucideIcon, TrendingDown, TrendingUp } from "lucide-react";

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  trend?: number;
  accent?: "primary" | "accent" | "info" | "danger";
}

const accents: Record<NonNullable<StatCardProps["accent"]>, string> = {
  primary: "from-primary/20 to-primary/5 text-primary",
  accent: "from-accent/20 to-accent/5 text-accent",
  info: "from-sky-500/20 to-sky-500/5 text-sky-500",
  danger: "from-red-500/20 to-red-500/5 text-red-500",
};

export function StatCard({ label, value, icon: Icon, trend, accent = "primary" }: StatCardProps) {
  const display = typeof value === "number" ? formatNumber(value) : value;
  const positive = (trend ?? 0) >= 0;
  return (
    <Card className="p-5 relative overflow-hidden">
      <div className={cn("absolute -top-10 -right-10 w-32 h-32 rounded-full blur-2xl bg-gradient-to-br", accents[accent])} />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
          <p className="text-3xl font-bold mt-2 tracking-tight">{display}</p>
          {trend !== undefined && (
            <div className={cn("flex items-center gap-1 mt-2 text-xs font-medium", positive ? "text-primary" : "text-red-500")}>
              {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {Math.abs(trend)}% vs last week
            </div>
          )}
        </div>
        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br", accents[accent])}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </Card>
  );
}
