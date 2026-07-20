"use client";

import { useSyncExternalStore } from "react";
import styles from "./ThemeToggle.module.css";

type Theme = "dark" | "light";

// External store: the source of truth is the DOM (`<html data-theme>`), set by
// the no-FOUC script before hydration. Toggling updates the DOM and notifies
// subscribers, so no setState-in-effect is needed.
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function getThemeSnapshot(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function getServerSnapshot(): Theme {
  return "dark";
}

function setTheme(next: Theme) {
  if (next === "light") {
    document.documentElement.dataset.theme = "light";
  } else {
    delete document.documentElement.dataset.theme;
  }
  try {
    localStorage.setItem("app-theme", next);
  } catch {
    // ignore storage failures (private mode, etc.)
  }
  listeners.forEach((l) => l());
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getThemeSnapshot, getServerSnapshot);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <button
      className={styles.toggle}
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
    >
      <span className={styles.icon} aria-hidden="true">
        {theme === "dark" ? "☀" : "☾"}
      </span>
      <span className={styles.label}>{theme === "dark" ? "Light" : "Dark"}</span>
    </button>
  );
}
