"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "universal-bookmark:theme";

interface ThemeContextValue {
  preference: ThemePreference;
  setPreference: (pref: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [hydrated, setHydrated] = useState(false);

  // Read any stored preference once on mount. The inline script in
  // app/layout.tsx already applied the correct class before paint, so this
  // just brings React's state in sync — it doesn't cause a flash.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY) as ThemePreference | null;
      if (stored === "light" || stored === "dark" || stored === "system") {
        setPreferenceState(stored);
      }
    } catch {
      // Ignore inaccessible storage — default to "system".
    } finally {
      setHydrated(true);
    }
  }, []);

  // Apply the resolved theme to <html>, and keep it in sync with the OS
  // when the preference is "system".
  useEffect(() => {
    const root = document.documentElement;

    function applyDark(isDark: boolean) {
      root.classList.toggle("dark", isDark);
    }

    if (preference === "system") {
      const mql = window.matchMedia("(prefers-color-scheme: dark)");
      applyDark(mql.matches);
      const handler = (e: MediaQueryListEvent) => applyDark(e.matches);
      mql.addEventListener("change", handler);
      return () => mql.removeEventListener("change", handler);
    }

    applyDark(preference === "dark");
  }, [preference]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      // Storage may be unavailable — theme still works for the session.
    }
  }, [preference, hydrated]);

  function setPreference(pref: ThemePreference) {
    setPreferenceState(pref);
  }

  return (
    <ThemeContext.Provider value={{ preference, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}
