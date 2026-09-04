import { api, ApiError } from "@/lib/api";
import { num, usd } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { ApiErrorCard } from "@/components/states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";

export const dynamic = "force-dynamic";

const METRIC_ROWS: { key: keyof SegRow; label: string; fmt: (v: number | null) => string }[] = [
  { key: "energy_kwh", label: "Energy", fmt: (v) => `${num(v, 1)} kWh` },
  { key: "duration_hours", label: "Duration", fmt: (v) => `${num(v, 2)} h` },
  { key: "distance_km", label: "Distance", fmt: (v) => `${num(v, 0)} km` },
  { key: "soc_delta_pct", label: "SOC gain", fmt: (v) => `${num(v, 1)} pts` },
  { key: "charging_rate_kw", label: "Rate", fmt: (v) => `${num(v, 1)} kW` },
  { key: "cost_usd", label: "Cost", fmt: (v) => usd(v) },
];

type SegRow = Awaited<ReturnType<typeof api.segments>>[number];

export default async function SegmentsPage() {
  let segments: SegRow[];
  try {
    segments = await api.segments();
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <>
          <PageHeader title="Session Segments" />
          <ApiErrorCard message={error.message} />
        </>
      );
    }
    throw error;
  }

  const total = segments.reduce((sum, s) => sum + s.n_sessions, 0);

  return (
    <>
      <PageHeader
        title="Session Segments"
        description="K-Means over six behavioural features. The silhouette score is about 0.12, so these are descriptive slices of one continuum, not sharply separated personas."
      />

      <div className="grid gap-4 md:grid-cols-2">
        {segments.map((seg) => (
          <Card key={seg.cluster}>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>{seg.archetype ?? `Cluster ${seg.cluster}`}</CardTitle>
                <Badge tone="info">
                  {num(seg.n_sessions)} · {num((seg.n_sessions / total) * 100, 0)}%
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-3 gap-3 text-sm">
                {METRIC_ROWS.map((m) => (
                  <div key={m.key}>
                    <dt className="text-xs text-text-muted">{m.label}</dt>
                    <dd className="tabular font-medium text-text-primary">
                      {m.fmt(seg[m.key] as number | null)}
                    </dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>All clusters</CardTitle>
        </CardHeader>
        <CardContent>
          <Table className="tabular">
            <THead>
              <TR>
                <TH>Archetype</TH>
                <TH>Sessions</TH>
                {METRIC_ROWS.map((m) => (
                  <TH key={m.key}>{m.label}</TH>
                ))}
              </TR>
            </THead>
            <tbody>
              {segments.map((seg) => (
                <TR key={seg.cluster}>
                  <TD className="font-medium text-text-primary">
                    {seg.archetype ?? `Cluster ${seg.cluster}`}
                  </TD>
                  <TD>{num(seg.n_sessions)}</TD>
                  {METRIC_ROWS.map((m) => (
                    <TD key={m.key}>{m.fmt(seg[m.key] as number | null)}</TD>
                  ))}
                </TR>
              ))}
            </tbody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
