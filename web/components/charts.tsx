"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const SERIES = ["var(--series-1)", "var(--series-2)", "var(--series-3)"];

interface SeriesDef {
  key: string;
  name: string;
}

const axisProps = {
  stroke: "var(--axis)",
  tick: { fill: "var(--text-muted)", fontSize: 12 },
  tickLine: false,
} as const;

function ChartTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string | number;
  unit?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-surface px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-text-primary">{label}</p>
      {payload.map((row) => (
        <p key={row.name} className="flex items-center gap-1.5 text-text-secondary">
          <span
            className="inline-block h-2 w-2 rounded-sm"
            style={{ background: row.color }}
          />
          {row.name}:{" "}
          <span className="tabular font-medium text-text-primary">
            {row.value?.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            {unit ? ` ${unit}` : ""}
          </span>
        </p>
      ))}
    </div>
  );
}

export function BarChartCard({
  data,
  xKey,
  series,
  unit,
  height = 300,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  series: SeriesDef[];
  unit?: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 4 }} barGap={2}>
        <CartesianGrid stroke="var(--grid)" vertical={false} />
        <XAxis dataKey={xKey} {...axisProps} />
        <YAxis {...axisProps} width={44} />
        <Tooltip
          cursor={{ fill: "var(--surface-2)" }}
          content={<ChartTooltip unit={unit} />}
        />
        {series.length > 1 && (
          <Legend
            wrapperStyle={{ fontSize: 12, color: "var(--text-secondary)" }}
            iconType="square"
          />
        )}
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.name}
            fill={SERIES[i % SERIES.length]}
            radius={[4, 4, 0, 0]}
            maxBarSize={48}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function LineChartCard({
  data,
  xKey,
  series,
  unit,
  height = 320,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  series: SeriesDef[];
  unit?: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
        <CartesianGrid stroke="var(--grid)" vertical={false} />
        <XAxis dataKey={xKey} {...axisProps} />
        <YAxis {...axisProps} width={44} />
        <Tooltip content={<ChartTooltip unit={unit} />} />
        <Legend
          wrapperStyle={{ fontSize: 12, color: "var(--text-secondary)" }}
          iconType="plainline"
        />
        {series.map((s, i) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={SERIES[i % SERIES.length]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
