import { Info } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { num } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { ApiErrorCard } from "@/components/states";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ForecastChart } from "./forecast-chart";

export const dynamic = "force-dynamic";

export default async function ForecastPage() {
  let forecast;
  try {
    forecast = await api.forecast(24);
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <>
          <PageHeader title="Demand Forecast" />
          <ApiErrorCard message={error.message} />
        </>
      );
    }
    throw error;
  }

  const peak = [...forecast.points].sort(
    (a, b) => b.predicted_energy_kwh - a.predicted_energy_kwh,
  )[0];

  return (
    <>
      <PageHeader
        title="Demand Forecast"
        description="Network charging energy per hour, forecast recursively for the next 24 hours from the last observed hour."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Historical mean"
          value={`${num(forecast.baseline_mean_kwh, 1)} kWh/h`}
        />
        <KpiCard
          label="Forecast peak"
          value={`${num(peak.predicted_energy_kwh, 1)} kWh`}
          sub={`at ${String(peak.hour).padStart(2, "0")}:00`}
        />
        <KpiCard label="Horizon" value={`${forecast.horizon_hours} h`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Actual vs forecast</CardTitle>
        </CardHeader>
        <CardContent>
          <ForecastChart forecast={forecast} />
        </CardContent>
      </Card>

      <Card className="mt-4 border-series-1/30 bg-series-1/5">
        <CardContent className="flex items-start gap-3 pt-5 text-sm text-text-secondary">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-series-1" />
          <p>{forecast.caveat}</p>
        </CardContent>
      </Card>
    </>
  );
}
