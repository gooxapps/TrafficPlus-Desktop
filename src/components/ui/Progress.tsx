import { cn } from "@/lib/utils";

export function Progress({ value, className, indicatorClassName }: { value: number; className?: string; indicatorClassName?: string }) {
  return (
    <div className={cn("w-full h-2 rounded-full bg-muted overflow-hidden", className)}>
      <div
        className={cn("h-full gradient-primary transition-all duration-500", indicatorClassName)}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}
