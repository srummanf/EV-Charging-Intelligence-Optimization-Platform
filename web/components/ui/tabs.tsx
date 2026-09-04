"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface TabsProps {
  tabs: { value: string; label: string }[];
  children: (active: string) => React.ReactNode;
  initial?: string;
}

export function Tabs({ tabs, children, initial }: TabsProps) {
  const [active, setActive] = React.useState(initial ?? tabs[0]?.value);

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        className="flex flex-wrap gap-1 rounded-lg border bg-surface-2 p-1"
      >
        {tabs.map((tab) => (
          <button
            key={tab.value}
            role="tab"
            aria-selected={active === tab.value}
            onClick={() => setActive(tab.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active === tab.value
                ? "bg-surface text-text-primary shadow-sm"
                : "text-text-secondary hover:text-text-primary",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div>{children(active)}</div>
    </div>
  );
}
