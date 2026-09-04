import type { CSSProperties, ReactNode } from "react";

/**
 * Full-bleed dotted texture for chart and profile cards, so the analytics and
 * segments surfaces carry the same "measured grid" feel as the metric cards.
 * Soft radial mask keeps it as texture rather than a hard grid; place it as the
 * first child of a `relative` container and render real content above it.
 */
export function DotField({
  accentStroke,
  className,
  focus = "70% 25%",
}: {
  accentStroke?: string;
  className?: string;
  /** Where the dots are densest before the mask fades them. */
  focus?: string;
}) {
  const mask = `radial-gradient(135% 135% at ${focus}, black 30%, transparent 92%)`;
  const style: CSSProperties = {
    backgroundImage:
      "radial-gradient(color-mix(in oklab, var(--foreground) 14%, transparent) 1px, transparent 1px)",
    backgroundSize: "13px 13px",
    WebkitMaskImage: mask,
    maskImage: mask,
  };
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 z-0 ${className ?? ""}`}
    >
      {accentStroke ? (
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(120% 90% at ${focus}, color-mix(in oklab, ${accentStroke} 9%, transparent), transparent 75%)`,
          }}
        />
      ) : null}
      <div className="absolute inset-0" style={style} />
    </div>
  );
}

/**
 * The signature "bleed" of the metric-card language: a visual (chart, sparkline)
 * that runs off the right edge of a card, behind the copy, dissolved into a
 * masked dot grid and a faint accent wash. Shared by ProgressMetricCard and
 * MetricPanel so every metric surface reads as one system.
 *
 * Pure presentation, no hooks: the dot grid is a CSS radial-gradient (same
 * technique as `.page-grid`), so there is no SVG pattern id to collide.
 */
export function MetricRegion({
  accentStroke,
  widthPct = 60,
  children,
}: {
  accentStroke: string;
  widthPct?: number;
  children?: ReactNode;
}) {
  return (
    <div
      aria-hidden
      className="absolute inset-y-0 right-0 z-0"
      style={{ width: `${widthPct}%` }}
    >
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(to left, color-mix(in oklab, ${accentStroke} 13%, transparent), transparent 80%)`,
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(color-mix(in oklab, var(--foreground) 15%, transparent) 1px, transparent 1px)",
          backgroundSize: "13px 13px",
          WebkitMaskImage:
            "linear-gradient(to right, transparent, black 58%)",
          maskImage: "linear-gradient(to right, transparent, black 58%)",
        }}
      />
      {children ? (
        <div className="absolute inset-0">{children}</div>
      ) : null}
    </div>
  );
}
