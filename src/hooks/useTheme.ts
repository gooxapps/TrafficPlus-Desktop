import { useEffect, useState } from "react";

type Theme = "dark" | "light";
const KEY = "trafficplus:theme";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "dark";
    return (localStorage.getItem(KEY) as Theme) || "dark";
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    localStorage.setItem(KEY, theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
  return { theme, toggle, setTheme };
}
