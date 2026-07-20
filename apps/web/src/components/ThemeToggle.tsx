"use client";

import { useEffect, useState } from "react";
import styles from "./ThemeToggle.module.css";

type Theme = "dark" | "light";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("app-theme") as Theme | null;
    if (stored === "light" || stored === "dark") {
      setTheme(stored);
    }
  }, []);

  const toggleTheme = () => {
    const newTheme: Theme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("app-theme", newTheme);
    
    if (newTheme === "light") {
      document.documentElement.dataset.theme = "light";
    } else {
      delete document.documentElement.dataset.theme;
    }
  };

  // Prevent flash during SSR
  if (!mounted) {
    return (
      <button className={styles.toggle} aria-label="Toggle theme" disabled>
        <span className={styles.icon} aria-hidden="true">
          ○
        </span>
      </button>
    );
  }

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
