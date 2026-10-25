"use client";

import { useEffect, useState } from "react";
import { MonitorIcon, MoonIcon, SunIcon } from "@/lib/icons";

type Theme = "system" | "light" | "dark";

const ORDER: Theme[] = ["system", "light", "dark"];
const LABEL: Record<Theme, string> = {
  system: "Auto",
  light: "Clair",
  dark: "Sombre",
};
const ICON = { system: MonitorIcon, light: SunIcon, dark: MoonIcon };

function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") {
    delete root.dataset.theme;
    localStorage.removeItem("theme");
  } else {
    root.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }
}

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") setTheme(saved);
  }, []);

  const Icon = ICON[theme];

  return (
    <button
      type="button"
      className={className}
      aria-label={`Changer le thème (actuel : ${LABEL[theme].toLowerCase()})`}
      onClick={() => {
        const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
        apply(next);
        setTheme(next);
      }}
    >
      <Icon />
      <span>{LABEL[theme]}</span>
    </button>
  );
}