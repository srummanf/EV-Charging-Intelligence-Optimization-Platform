import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ACCENTS, type MetricAccent } from "./metric-tokens";
import { DotField, MetricRegion } from "./metric-visuals";

/**
 * A static sibling of ProgressMetricCard: the same shell (squircle radius, right
 * bleed, hairline footer with a primary delta and a secondary stat run) for
 * metrics that are a single number plus context rather than a full time series.
 */
export function MetricPanel({
  label,
  sublabel,
  action,
  value,
  unit,
  accent = "blue",
  bleed,
  bleedWidth,
  footerPrimary,
  footerSecondary,
  size = "md",
  className,
  children,
}: {
  label: string;
  sublabel?: string;
  action?: ReactNode;
  value: ReactNode;
  unit?: string;
  accent?: MetricAccent;
  bleed?: ReactNode;
  bleedWidth?: number;
  footerPrimary?: ReactNode;
  footerSecondary?: ReactNode;
  size?: "sm" | "md";
  className?: string;
  /** Optional body between the headline and the footer. */
  children?: ReactNode;
}) {
  const color = ACCENTS[accent];
  const pad = size === "sm" ? "px-5 pt-4" : "px-6 pt-5";
  const foot = size === "sm" ? "px-5 py-2.5" : "px-6 py-3";
  const headline = size === "sm" ? "text-[32px]" : "text-[46px]";

  return (
    <div
      className={cn(
        "group relative flex min-h-[150px] w-full flex-col overflow-hidden rounded-[24px] border border-border bg-card",
        "shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-[transform,box-shadow,border-color] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
        "hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-14px_rgb(0_0_0/0.22)]",
        className,
      )}
    >
      {bleed ? (
        <MetricRegion accentStroke={color.stroke} widthPct={bleedWidth}>
          {bleed}
        </MetricRegion>
      ) : (
        <DotField accentStroke={color.stroke} focus="90% 10%" />
      )}

      <div
        className={cn(
          "pointer-events-none relative z-10 flex flex-1 flex-col",
          pad,
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold tracking-tight text-foreground">
              {label}
            </h3>
            {sublabel ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{sublabel}</p>
            ) : null}
          </div>
          {action ? (
            <div className="pointer-events-auto shrink-0">{action}</div>
          ) : null}
        </div>

        <div
          className={cn(
            "font-display mt-4 font-medium leading-none tracking-tight text-foreground tabular-nums",
            headline,
          )}
        >
          {value}
          {unit ? (
            <span className="ml-1.5 text-[0.32em] font-medium tracking-normal text-muted-foreground">
              {unit}
            </span>
          ) : null}
        </div>

        {children ? (
          <div className="pointer-events-auto mt-4 max-w-[min(100%,26rem)]">
            {children}
          </div>
        ) : null}
      </div>

      {footerPrimary || footerSecondary ? (
        <div
          className={cn(
            "relative z-10 flex items-center justify-between gap-4 border-t border-foreground/[0.06] bg-card text-[13px]",
            foot,
          )}
        >
          <div className="font-medium" style={{ color: color.text }}>
            {footerPrimary}
          </div>
          {footerSecondary ? (
            <div className="nums flex items-center gap-2 text-[12px] text-muted-foreground">
              {footerSecondary}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Footer stat run: `62 kWh / 2.1 h / 25 kW` with hairline slashes. */
export function MetricStats({ items }: { items: [string, string][] }) {
  return (
    <>
      {items.map(([v, l], i) => (
        <span key={l} className="flex items-center gap-2">
          {i > 0 ? <span className="opacity-40">/</span> : null}
          <span>
            <span className="font-medium text-foreground/80">{v}</span> {l}
          </span>
        </span>
      ))}
    </>
  );
}
