import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

interface ActivityChartProps {
  data: { day: string; earned: number; spent: number }[];
}

export function ActivityChart({ data }: ActivityChartProps) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="earned" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(158 84% 45%)" stopOpacity={0.5} />
            <stop offset="95%" stopColor="hsl(158 84% 45%)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="spent" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(38 95% 58%)" stopOpacity={0.45} />
            <stop offset="95%" stopColor="hsl(38 95% 58%)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Area type="monotone" dataKey="earned" stroke="hsl(158 84% 45%)" fill="url(#earned)" strokeWidth={2} />
        <Area type="monotone" dataKey="spent" stroke="hsl(38 95% 58%)" fill="url(#spent)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
