"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "system", icon: Monitor, label: "System" },
  { value: "dark", icon: Moon, label: "Dark" },
] as const;

const noop = () => () => {};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // false during SSR and the first client render, true afterwards — no effect, no
  // setState, so the theme buttons stay inert until hydration and never mismatch.
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );

  return (
    <div className="flex items-center gap-0.5 rounded-md border bg-surface p-0.5">
      {OPTIONS.map(({ value, icon: Icon, label }) => {
        const active = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            aria-label={label}
            aria-pressed={active}
            onClick={() => setTheme(value)}
            className={cn(
              "rounded p-1.5 text-text-muted transition-colors hover:text-text-primary",
              active && "bg-surface-2 text-text-primary",
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
