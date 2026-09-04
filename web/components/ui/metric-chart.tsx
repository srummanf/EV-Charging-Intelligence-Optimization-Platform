"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  ACCENTS,
  formatCompact,
  SERIES_COLORS,
  type ChartSeries,
  type ChartView,
  type MetricAccent,
  type MetricSeries,
  type SeriesPoint,
} from "./metric-tokens";

export {
  ACCENTS,
  formatCompact,
  SERIES_COLORS,
  type ChartSeries,
  type ChartView,
  type MetricAccent,
  type MetricSeries,
  type SeriesPoint,
};

interface TipProps {
  active?: boolean;
  payload?: Array<{
    dataKey: string;
    value: number | null;
    color?: string;
    stroke?: string;
    payload: Record<string, string | number | null>;
  }>;
  series: ChartSeries[];
  valueFormatter: (n: number) => string;
  dateFormatter: (d: string) => string;
}

function MetricTip({
  active,
  payload,
  series,
  valueFormatter,
  dateFormatter,
}: TipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const rows = payload.filter((p) => p.value != null);
  if (!rows.length) return null;
  return (
    <div className="pointer-events-none min-w-32 rounded-lg border bg-popover px-2.5 py-1.5 text-xs shadow-xl">
      <div className="mb-1 font-medium text-popover-foreground">
        {dateFormatter(String(row.date ?? ""))}
      </div>
      <div className="space-y-0.5">
        {rows.map((p) => {
          const idx = Number(String(p.dataKey).replace("s", "")) || 0;
          return (
            <div
              key={p.dataKey}
              className="flex items-center justify-between gap-3 text-muted-foreground"
            >
              <span className="flex items-center gap-1.5">
                <span
                  className="size-1.5 rounded-full"
                  style={{ background: p.color ?? p.stroke }}
                />
                {series.length > 1 ? series[idx]?.name : null}
              </span>
              <span className="nums font-medium text-popover-foreground">
                {valueFormatter(Number(p.value))}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function MetricChart({
  series,
  view,
  valueFormatter,
  dateFormatter,
}: {
  series: ChartSeries[];
  view: ChartView;
  /** Accepted for API parity; the crosshair is hover-driven. */
  defaultIndex?: number;
  valueFormatter: (n: number) => string;
  dateFormatter: (d: string) => string;
}) {
  const rows = useMemo(() => {
    const len = Math.max(0, ...series.map((s) => s.data.length));
    return Array.from({ length: len }, (_, i) => {
      const row: Record<string, string | number | null> = {
        date: series.find((s) => s.data[i])?.data[i]?.date ?? "",
      };
      series.forEach((s, si) => {
        row[`s${si}`] = s.data[i]?.value ?? null;
      });
      return row;
    });
  }, [series]);

  const shared = (
    <>
      <defs>
        {series.map((s, i) => (
          <linearGradient
            key={i}
            id={`mc-fill-${i}`}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0%" stopColor={s.color} stopOpacity={0.24} />
            <stop offset="100%" stopColor={s.color} stopOpacity={0} />
          </linearGradient>
        ))}
      </defs>
      <XAxis dataKey="date" hide />
      <Tooltip
        cursor={{ stroke: "var(--foreground)", strokeOpacity: 0.16 }}
        content={
          <MetricTip
            series={series}
            valueFormatter={valueFormatter}
            dateFormatter={dateFormatter}
          />
        }
      />
    </>
  );

  return (
    <ResponsiveContainer width="100%" height="100%">
      {view === "bar" ? (
        <BarChart data={rows} margin={{ top: 48, right: 0, bottom: 0, left: 0 }}>
          {shared}
          <YAxis hide domain={[0, "dataMax"]} />
          {series.map((s, i) => (
            <Bar
              key={i}
              dataKey={`s${i}`}
              fill={s.color}
              radius={[3, 3, 0, 0]}
              maxBarSize={20}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      ) : (
        <AreaChart data={rows} margin={{ top: 56, right: 0, bottom: 0, left: 0 }}>
          {shared}
          <YAxis hide domain={["dataMin", "dataMax"]} />
          {series.map((s, i) => (
            <Area
              key={i}
              type="monotone"
              dataKey={`s${i}`}
              stroke={s.color}
              strokeWidth={2}
              fill={`url(#mc-fill-${i})`}
              dot={false}
              activeDot={{ r: 3, strokeWidth: 2, stroke: "var(--card)" }}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </AreaChart>
      )}
    </ResponsiveContainer>
  );
}
