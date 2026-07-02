import { useEffect, useState } from "react";
import { onDataChange } from "@/lib/storage";

/**
 * Subscribes a component to async data that may change
 */
export function useStoredAsync<T>(getter: () => Promise<T>, initialValue: T): T {
  const [val, setVal] = useState<T>(initialValue);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getter();
        setVal(data);
      } catch (err) {
        console.error("useStoredAsync failed to load:", err);
      } finally {
        setLoading(false);
      }
    };

    load();
    const offData = onDataChange(() => load());
    const onFocus = () => load();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        load();
      }
    };

    window.addEventListener('focus', onFocus);
    window.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      offData();
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [getter]);

  return val;
}
