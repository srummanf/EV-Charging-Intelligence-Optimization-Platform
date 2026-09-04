"use client";

import { Activity, BarChart3, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChartView } from "./metric-chart";

export interface PeriodOption {
  label: string;
  /** Trailing points to keep. Omit to keep the whole series. */
  points?: number;
}

export function ViewToggle({
  value,
  onChange,
}: {
  value: ChartView;
  onChange: (v: ChartView) => void;
}) {
  const items: [ChartView, typeof Activity][] = [
    ["curve", Activity],
    ["bar", BarChart3],
  ];
  return (
    <div className="pointer-events-auto flex items-center gap-0.5 rounded-lg border bg-card p-0.5">
      {items.map(([v, Icon]) => (
        <button
          key={v}
          type="button"
          aria-label={`${v} view`}
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={cn(
            "grid size-6 place-items-center rounded-[6px] text-muted-foreground transition-colors",
            "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
            value === v && "bg-muted text-foreground",
          )}
        >
          <Icon className="size-3.5" />
        </button>
      ))}
    </div>
  );
}

export function PeriodSelect({
  value,
  options,
  onChange,
  accentText,
}: {
  value: string;
  options: PeriodOption[];
  onChange: (option: PeriodOption) => void;
  accentText?: string;
}) {
  if (options.length <= 1) return null;
  return (
    <div className="pointer-events-auto relative">
      <select
        value={value}
        onChange={(e) => {
          const next = options.find((o) => o.label === e.target.value);
          if (next) onChange(next);
        }}
        className="nums appearance-none rounded-md border bg-card py-1 pl-2.5 pr-7 text-[13px] font-medium text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/60"
        style={accentText ? { color: accentText } : undefined}
      >
        {options.map((o) => (
          <option key={o.label} value={o.label} className="text-foreground">
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
