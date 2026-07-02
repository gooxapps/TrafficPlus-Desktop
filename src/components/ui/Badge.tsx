import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

type Variant = "default" | "primary" | "accent" | "success" | "warning" | "danger" | "muted";

const variants: Record<Variant, string> = {
  default: "bg-secondary text-secondary-foreground",
  primary: "bg-primary/15 text-primary border border-primary/30",
  accent: "bg-accent/15 text-accent border border-accent/30",
  success: "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30",
  warning: "bg-amber-500/15 text-amber-500 border border-amber-500/30",
  danger: "bg-red-500/15 text-red-500 border border-red-500/30",
  muted: "bg-muted text-muted-foreground",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
        variants[variant], className
      )}
      {...props}
    />
  );
}
