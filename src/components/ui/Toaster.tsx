import { useToasts } from "@/hooks/useToast";
import { Check, X, AlertCircle } from "lucide-react";

export function Toaster() {
  const { toasts, dismiss } = useToasts();
  return (
    <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 w-[320px]">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="bg-card border border-border rounded-lg shadow-lg p-4 flex items-start gap-3 animate-in slide-in-from-right"
        >
          <div className="mt-0.5">
            {t.variant === "success" && <Check className="w-5 h-5 text-primary" />}
            {t.variant === "error" && <AlertCircle className="w-5 h-5 text-destructive" />}
            {(!t.variant || t.variant === "default") && <Check className="w-5 h-5 text-accent" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{t.title}</p>
            {t.description && <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>}
          </div>
          <button onClick={() => dismiss(t.id)} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
