"use client";

import type { Forecast } from "@/lib/types";
import { AreaChartCard } from "@/components/charts";

function label(ts: string) {
  const d = new Date(ts);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(
    d.getHours(),
  ).padStart(2, "0")}h`;
}

export function ForecastChart({ forecast }: { forecast: Forecast }) {
  const rows: Record<string, unknown>[] = forecast.history.map((h) => ({
    t: label(h.timestamp),
    actual: h.energy_kwh,
  }));

  const lastActual = forecast.history.at(-1);
  const splitAt = lastActual ? label(lastActual.timestamp) : undefined;
  if (lastActual) {
    rows.push({
      t: label(lastActual.timestamp),
      actual: lastActual.energy_kwh,
      forecast: lastActual.energy_kwh,
    });
  }
  for (const p of forecast.points) {
    rows.push({ t: label(p.timestamp), forecast: p.predicted_energy_kwh });
  }

  return (
    <AreaChartCard
      data={rows}
      xKey="t"
      series={[
        { key: "actual", name: "Actual" },
        { key: "forecast", name: `Forecast (+${forecast.horizon_hours} h)` },
      ]}
      unit="kWh"
      height={320}
      splitAt={splitAt}
    />
  );
}
