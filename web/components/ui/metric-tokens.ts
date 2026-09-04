// Framework-neutral tokens and types for the metric-card language. Kept in a
// plain module (no "use client") so Server Components can read the real values,
// not a client-reference proxy.

export interface SeriesPoint {
  value: number;
  date: string;
}
export interface MetricSeries {
  name: string;
  data: SeriesPoint[];
  accent?: MetricAccent;
}
export type MetricAccent = "emerald" | "rose" | "neutral" | "blue" | "amber";
export type ChartView = "curve" | "bar";
export interface ChartSeries {
  name: string;
  data: SeriesPoint[];
  color: string;
}

/**
 * Accent tokens map onto the project's OKLCH theme variables so the cards
 * follow light / dark automatically. `stroke` also feeds the color-mix wash.
 */
export const ACCENTS: Record<MetricAccent, { stroke: string; text: string }> = {
  emerald: { stroke: "var(--chart-3)", text: "var(--success)" },
  rose: { stroke: "var(--danger)", text: "var(--danger)" },
  neutral: { stroke: "var(--chart-axis)", text: "var(--muted-foreground)" },
  blue: { stroke: "var(--chart-1)", text: "var(--chart-1)" },
  amber: { stroke: "var(--chart-2)", text: "var(--chart-2)" },
};

export const SERIES_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
];

export const formatCompact = (value: number) =>
  new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
