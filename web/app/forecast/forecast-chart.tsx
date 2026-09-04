"use client";

import type { Forecast } from "@/lib/types";
import { LineChartCard } from "@/components/charts";

function label(ts: string) {
  const d = new Date(ts);
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(
    d.getHours(),
  ).padStart(2, "0")}h`;
}

export function ForecastChart({ forecast }: { forecast: Forecast }) {
  const rows: Record<string, unknown>[] = forecast.history.map((h) => ({
    t: label(h.timestamp),
    Actual: h.energy_kwh,
  }));

  const lastActual = forecast.history.at(-1);
  if (lastActual) {
    rows.push({ t: label(lastActual.timestamp), Actual: lastActual.energy_kwh, Forecast: lastActual.energy_kwh });
  }
  for (const p of forecast.points) {
    rows.push({ t: label(p.timestamp), Forecast: p.predicted_energy_kwh });
  }

  return (
    <LineChartCard
      data={rows}
      xKey="t"
      series={[
        { key: "Actual", name: "Actual (last 72 h)" },
        { key: "Forecast", name: `Forecast (+${forecast.horizon_hours} h)` },
      ]}
      unit="kWh"
      height={340}
    />
  );
}
