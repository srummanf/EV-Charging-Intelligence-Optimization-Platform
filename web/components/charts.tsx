"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const SERIES = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"];

interface SeriesDef {
  key: string;
  name: string;
}

const axis = {
  stroke: "var(--chart-axis)",
  tick: { fill: "var(--muted-foreground)", fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

function ChartTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string; dataKey: string }[];
  label?: string | number;
  unit?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-36 rounded-lg border bg-popover px-3 py-2 text-xs shadow-xl">
      <p className="mb-1.5 font-medium text-popover-foreground">{label}</p>
      <div className="space-y-1">
        {payload
          .filter((r) => r.value != null)
          .map((row) => (
            <div key={row.dataKey} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span
                  className="size-2 rounded-[3px]"
                  style={{ background: row.color }}
                />
                {row.name}
              </span>
              <span className="nums font-medium tabular-nums text-popover-foreground">
                {row.value?.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                {unit ? ` ${unit}` : ""}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}

const legendStyle = { fontSize: 11, paddingTop: 8 } as const;

export function BarChartCard({
  data,
  xKey,
  series,
  unit,
  height = 280,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  series: SeriesDef[];
  unit?: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -8 }} barGap={3}>
        <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
        <XAxis dataKey={xKey} {...axis} interval="preserveStartEnd" minTickGap={8} />
        <YAxis {...axis} width={44} />
        <Tooltip
          cursor={{ fill: "var(--muted)", opacity: 0.6 }}
          content={<ChartTooltip unit={unit} />}
        />
        {series.length > 1 && (
          <Legend iconType="circle" iconSize={8} wrapperStyle={legendStyle} />
        )}
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.name}
            fill={SERIES[i % SERIES.length]}
            radius={[5, 5, 2, 2]}
            maxBarSize={44}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function AreaChartCard({
  data,
  xKey,
  series,
  unit,
  height = 300,
  splitAt,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  series: SeriesDef[];
  unit?: string;
  height?: number;
  /** x-value where a shaded "forecast" region begins */
  splitAt?: string | number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERIES[i % SERIES.length]} stopOpacity={0.16} />
              <stop offset="90%" stopColor={SERIES[i % SERIES.length]} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
        <XAxis dataKey={xKey} {...axis} interval="preserveStartEnd" minTickGap={24} />
        <YAxis {...axis} width={44} />
        {splitAt != null && (
          <ReferenceArea
            x1={splitAt}
            x2={data[data.length - 1]?.[xKey] as string | number}
            fill="var(--muted-foreground)"
            fillOpacity={0.06}
          />
        )}
        <Tooltip content={<ChartTooltip unit={unit} />} />
        {series.length > 1 && (
          <Legend iconType="plainline" iconSize={14} wrapperStyle={legendStyle} />
        )}
        {series.map((s, i) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={SERIES[i % SERIES.length]}
            strokeWidth={2}
            fill={`url(#fill-${s.key})`}
            dot={false}
            activeDot={{ r: 3, strokeWidth: 2, stroke: "var(--card)" }}
            isAnimationActive={false}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function LineChartCard(props: React.ComponentProps<typeof AreaChartCard>) {
  return <AreaChartCard {...props} />;
}

/** Tiny inline chart for stat cards, no axes, no grid. */
export function Sparkline({
  data,
  dataKey,
  height = 40,
  color = "var(--chart-1)",
}: {
  data: Record<string, unknown>[];
  dataKey: string;
  height?: number | `${number}%`;
  color?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 12, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`spark-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#spark-${dataKey})`}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
