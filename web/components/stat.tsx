import * as React from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * A row/grid of stats that share hairline dividers instead of floating as
 * separate cards. Reads as one designed panel.
 */
export function StatGrid({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid overflow-hidden rounded-[20px] border bg-card",
        "divide-x divide-y divide-border",
        "[&>*]:border-border",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Stat({
  label,
  value,
  unit,
  hint,
  icon,
  tip,
  emphasis = false,
  children,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  /** Optional definition shown behind a hover/focus info affordance. */
  tip?: string;
  emphasis?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 p-4">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon ? <span className="text-muted-foreground/60">{icon}</span> : null}
        {label}
        {tip ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={`About ${label}`}
                className="text-muted-foreground/35 transition-colors hover:text-muted-foreground focus-visible:outline-none focus-visible:text-muted-foreground"
              >
                <Info className="size-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{tip}</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
      <div className="flex items-baseline gap-1">
        <span
          className={cn(
            "font-display font-semibold tracking-tight tabular-nums leading-none",
            emphasis ? "text-[1.85rem]" : "text-xl text-foreground/90",
          )}
        >
          {value}
        </span>
        {unit ? (
          <span className="text-[0.8125rem] font-medium text-muted-foreground">
            {unit}
          </span>
        ) : null}
      </div>
      {hint ? (
        <div className="text-xs text-muted-foreground">{hint}</div>
      ) : null}
      {children ? <div className="pt-1">{children}</div> : null}
    </div>
  );
}

/** A thin horizontal proportion bar, for "X of Y" style context. */
export function MiniBar({
  value,
  className,
  tone = "primary",
}: {
  value: number; // 0..1
  className?: string;
  tone?: "primary" | "warning" | "danger";
}) {
  const toneClass =
    tone === "danger"
      ? "bg-danger"
      : tone === "warning"
        ? "bg-warning"
        : "bg-primary";
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div
        className={cn("h-full rounded-full", toneClass)}
        style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
      />
    </div>
  );
}
