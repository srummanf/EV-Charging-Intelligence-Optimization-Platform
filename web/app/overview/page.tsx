import { api, ApiError } from "@/lib/api";
import { num, usd } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { ApiErrorCard } from "@/components/states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  let data;
  try {
    const [overview, health] = await Promise.all([api.overview(), api.health()]);
    data = { overview, health };
  } catch (error) {
    if (error instanceof ApiError) return <Shell error={error.message} />;
    throw error;
  }

  const { overview, health } = data;
  const dq = overview.data_quality;

  return (
    <>
      <PageHeader
        title="Network Overview"
        description={`${overview.n_sessions.toLocaleString()} charging sessions across ${overview.n_stations} stations and ${overview.n_locations} cities, ${overview.date_start} to ${overview.date_end}.`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Sessions" value={num(overview.n_sessions)} />
        <KpiCard
          label="Total energy"
          value={`${num(overview.total_energy_kwh)} kWh`}
          sub={`${num(overview.mean_energy_kwh, 1)} kWh avg / session`}
        />
        <KpiCard
          label="Avg duration"
          value={`${num(overview.mean_duration_hours, 2)} h`}
        />
        <KpiCard
          label="Total cost"
          value={usd(overview.total_cost_usd, 0)}
          sub={`${usd(overview.mean_cost_usd)} avg / session`}
        />
        <KpiCard
          label="Avg charging rate"
          value={`${num(overview.mean_charging_rate_kw, 1)} kW`}
        />
        <KpiCard
          label="Avg SOC increase"
          value={`${num(overview.mean_soc_increase_pct, 1)} pts`}
        />
        <KpiCard label="Peak hour" value={`${String(overview.peak_hour).padStart(2, "0")}:00`} />
        <KpiCard
          label="Most-used charger"
          value={overview.most_used_charger_type}
          sub={`Highest demand: ${overview.highest_demand_location}`}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Data quality</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-text-secondary">
            <p>
              <span className="tabular font-semibold text-text-primary">
                {num(dq.n_sessions_flagged)}
              </span>{" "}
              of {num(overview.n_sessions)} sessions ({num(dq.pct_sessions_flagged, 1)}%) break
              at least one physical-consistency rule.
            </p>
            <p>
              This is a synthetic dataset generated column by column, so reported duration,
              charging rate and energy rarely agree. The platform measures the damage rather
              than hiding it; see the Anomalies view.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Service status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-text-secondary">
            <p className="flex items-center gap-2">
              <Badge tone={health.status === "ok" ? "normal" : "high"}>{health.status}</Badge>
              {health.models_loaded.length} models loaded
            </p>
            <ul className="tabular list-inside list-disc text-text-muted">
              {health.models_loaded.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
            <p className="text-text-muted">
              Analytics generated {health.analytics_generated_at ?? "—"}
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Shell({ error }: { error: string }) {
  return (
    <>
      <PageHeader title="Network Overview" />
      <ApiErrorCard message={error} />
    </>
  );
}
