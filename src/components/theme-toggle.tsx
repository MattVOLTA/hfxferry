"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { Toggle } from "@/components/ui/toggle";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  return (
    <Toggle
      pressed={isDark}
      onPressedChange={(pressed) => {
        setTheme(pressed ? "dark" : "light");
      }}
      aria-label="Toggle theme"
      className="h-10 w-10 rounded-full bg-muted hover:bg-accent hover:text-accent-foreground"
    >
      {isDark ? (
        <Moon className="h-5 w-5" />
      ) : (
        <Sun className="h-5 w-5" />
      )}
    </Toggle>
  );
}
