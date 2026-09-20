"use client";

import { useSyncExternalStore } from "react";
import { SegmentedControl } from "./SegmentedControl";

type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "theme";
// The native "storage" event only fires in *other* tabs, not the one that made the change,
// so we dispatch this ourselves to make useSyncExternalStore re-read localStorage here too.
const THEME_CHANGE_EVENT = "theme-toggle:change";

const OPTIONS: { value: Theme; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(THEME_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(THEME_CHANGE_EVENT, callback);
  };
}

function getSnapshot(): Theme {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isTheme(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

// Matches ThemeToggle's default before hydration reads the real value, avoiding a mismatch
// with the server-rendered markup (the blocking script in layout.tsx already applied the
// real theme to the DOM before paint — this only affects which option renders "selected").
function getServerSnapshot(): Theme {
  return "system";
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function handleChange(next: Theme) {
    if (next === "system") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", next);
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Theme just won't persist across reloads; not worth surfacing to the user.
    }
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }

  return <SegmentedControl aria-label="Color theme" options={OPTIONS} value={theme} onChange={handleChange} />;
}
