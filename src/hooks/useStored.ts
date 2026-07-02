import { useEffect, useState } from "react";
import { onDataChange } from "@/lib/storage";

/**
 * Subscribes a component to localStorage-backed data so it re-renders
 * whenever any persisted slice changes (cross-tab + same-tab).
 */
export function useStored<T>(getter: () => T): T {
  const [val, setVal] = useState<T>(getter);
  useEffect(() => {
    setVal(getter());
    return onDataChange(() => setVal(getter()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return val;
}
