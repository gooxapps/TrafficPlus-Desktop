import { useEffect, useState, useCallback } from "react";

interface Toast {
  id: number;
  title: string;
  description?: string;
  variant?: "default" | "success" | "error" | "warning" | "destructive";
}

let counter = 0;
const listeners = new Set<(t: Toast[]) => void>();
let toasts: Toast[] = [];

function emit() {
  listeners.forEach((l) => l([...toasts]));
}

export function toast(opts: Omit<Toast, "id">) {
  const t: Toast = { id: ++counter, ...opts };
  toasts = [...toasts, t];
  emit();
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== t.id);
    emit();
  }, 3500);
}

export function useToasts() {
  const [list, setList] = useState<Toast[]>(toasts);
  useEffect(() => {
    listeners.add(setList);
    return () => { listeners.delete(setList); };
  }, []);
  const dismiss = useCallback((id: number) => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, []);
  return { toasts: list, dismiss };
}
