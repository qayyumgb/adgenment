"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * App light/dark theme (guide §2.1). Applies the `.dark` class to <html>,
 * which swaps the --c-* tokens in globals.css. Mounted by the app shell only:
 * unmounting (going to the marketing site) removes the class, so marketing
 * pages always stay light.
 */

export type ThemePref = "light" | "dark" | "system";
type ThemeCtx = {
  theme: ThemePref;
  resolved: "light" | "dark";
  setTheme: (t: ThemePref) => void;
  toggle: () => void;
};

const STORAGE_KEY = "advertix.theme";
// Follows the device until someone picks light or dark (plan A15).
const DEFAULT_THEME: ThemePref = "system";

/** Inline script (render before content) so the first paint has the right theme. */
export const THEME_SCRIPT = `try{var t=localStorage.getItem('${STORAGE_KEY}')||'${DEFAULT_THEME}';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d)}catch(e){}`;

const Ctx = createContext<ThemeCtx | null>(null);

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "light" || v === "dark" || v === "system" ? v : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePref>(DEFAULT_THEME);
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    setThemeState(readPref());
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const resolved: "light" | "dark" = theme === "system" ? (systemDark ? "dark" : "light") : theme;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolved === "dark");
  }, [resolved]);

  // Leaving the app (e.g. to the marketing site) → back to light.
  useEffect(() => () => document.documentElement.classList.remove("dark"), []);

  const setTheme = useCallback((t: ThemePref) => {
    setThemeState(t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* private mode: in-memory only */
    }
  }, []);

  const toggle = useCallback(() => setTheme(resolved === "dark" ? "light" : "dark"), [resolved, setTheme]);

  return <Ctx.Provider value={{ theme, resolved, setTheme, toggle }}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
