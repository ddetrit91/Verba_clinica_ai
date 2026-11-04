"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    setTheme(document.documentElement.classList.contains("light") ? "light" : "dark");
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("light", next === "light");
    localStorage.setItem("verba-theme", next);
    setTheme(next);
  }

  const label = theme === "dark" ? "Светлая тема" : "Тёмная тема";
  return (
    <button type="button" className="theme-btn" onClick={toggle} aria-pressed={theme === "light"}>
      {label}
    </button>
  );
}
