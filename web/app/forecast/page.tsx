import { Info } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { num } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { ApiErrorCard } from "@/components/states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Reveal } from "@/components/motion";
import { MetricPanel, MetricStats } from "@/components/ui/metric-panel";
import { DotField } from "@/components/ui/metric-visuals";
import { Sparkline } from "@/components/charts";
import { ForecastChart } from "./forecast-chart";

export const dynamic = "force-dynamic";

const pad = (h: number) => String(h).padStart(2, "0");

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

  const pts = forecast.points;
  const forecastMean =
    pts.reduce((s, p) => s + p.predicted_energy_kwh, 0) / (pts.length || 1);
  const peak = [...pts].sort(
    (a, b) => b.predicted_energy_kwh - a.predicted_energy_kwh,
  )[0] ?? { predicted_energy_kwh: 0, hour: 0 };
  const low = [...pts].sort(
    (a, b) => a.predicted_energy_kwh - b.predicted_energy_kwh,
  )[0] ?? { predicted_energy_kwh: 0, hour: 0 };
  const deltaPct = forecast.baseline_mean_kwh
    ? ((forecastMean - forecast.baseline_mean_kwh) / forecast.baseline_mean_kwh) *
      100
    : 0;
  const spark = pts.map((p) => ({ h: p.hour, kwh: p.predicted_energy_kwh }));
  const genAt = forecast.generated_from.slice(5, 16).replace("T", " ");

  return (
    <>
      <PageHeader
        title="Demand Forecast"
        description="Network charging energy per hour, forecast recursively for the next 24 hours from the last observed hour."
      />

      <div className="space-y-8">
        <Reveal className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetricPanel
            label="Forecast mean"
            sublabel="next 24 hours"
            accent="blue"
            size="sm"
            value={num(forecastMean, 1)}
            unit="kWh/h"
            bleed={<Sparkline data={spark} dataKey="kwh" height="100%" />}
            bleedWidth={64}
            footerPrimary={`${deltaPct >= 0 ? "+" : ""}${num(deltaPct, 1)}% vs history`}
            footerSecondary={
              <MetricStats
                items={[
                  [num(peak.predicted_energy_kwh, 1), `kWh at ${pad(peak.hour)}:00`],
                ]}
              />
            }
          />
          <MetricPanel
            label="Historical mean"
            sublabel="72 observed hours"
            accent="neutral"
            size="sm"
            value={num(forecast.baseline_mean_kwh, 1)}
            unit="kWh/h"
            footerPrimary="No trend or seasonality"
            footerSecondary={
              <MetricStats
                items={[
                  [num(low.predicted_energy_kwh, 1), "low"],
                  [num(peak.predicted_energy_kwh, 1), "peak"],
                ]}
              />
            }
          />
          <MetricPanel
            label="Horizon"
            sublabel="one step ahead, fed back"
            accent="blue"
            size="sm"
            value={forecast.horizon_hours}
            unit="hours"
            footerPrimary={`from ${genAt}`}
          />
        </Reveal>

        <Reveal delay={80}>
          <Card className="relative overflow-hidden">
            <DotField accentStroke="var(--chart-1)" focus="82% 18%" />
            <CardHeader className="relative z-10">
              <CardTitle>Actual vs forecast</CardTitle>
              <p className="text-xs text-muted-foreground">
                Last 72 observed hours, then the {forecast.horizon_hours}-hour
                forecast (shaded).
              </p>
            </CardHeader>
            <CardContent className="relative z-10 pt-5">
              <ForecastChart forecast={forecast} />
            </CardContent>
          </Card>
        </Reveal>

        <Reveal delay={120}>
          <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/[0.05] p-4 text-sm text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0 text-primary" />
            <p className="leading-relaxed">{forecast.caveat}</p>
          </div>
        </Reveal>
      </div>
    </>
  );
}
