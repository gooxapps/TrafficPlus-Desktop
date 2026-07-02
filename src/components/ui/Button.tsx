import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "accent" | "destructive" | "default";
type Size = "sm" | "md" | "lg" | "icon" | "default";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variants: Record<Variant, string> = {
  primary: "gradient-primary text-primary-foreground hover:brightness-110 shadow-lg shadow-primary/20",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  ghost: "hover:bg-muted text-foreground",
  outline: "border border-border bg-transparent hover:bg-muted text-foreground",
  accent: "bg-accent text-accent-foreground hover:brightness-110 shadow-lg shadow-accent/20",
  destructive: "bg-destructive text-destructive-foreground hover:brightness-110",
  default: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-7 text-base",
  icon: "h-10 w-10",
  default: "h-11 px-5 text-sm",
};

export function buttonVariants({ variant = "primary", size = "md" }: { variant?: Variant; size?: Size } = {}) {
  return cn(variants[variant], sizes[size]);
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]",
        variants[variant], sizes[size], className
      )}
      {...props}
    />
  )
);
Button.displayName = "Button";
