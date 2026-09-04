import { api, ApiError } from "@/lib/api";
import { num, usd } from "@/lib/utils";
import { PageHeader, SectionTitle } from "@/components/page-header";
import { ApiErrorCard } from "@/components/states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/motion";
import { DotField } from "@/components/ui/metric-visuals";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

const CLUSTER_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"];

export const dynamic = "force-dynamic";

type SegRow = Awaited<ReturnType<typeof api.segments>>[number];

const METRICS: {
  key: keyof SegRow;
  label: string;
  fmt: (v: number | null) => string;
}[] = [
  { key: "energy_kwh", label: "Energy", fmt: (v) => `${num(v, 1)} kWh` },
  { key: "duration_hours", label: "Duration", fmt: (v) => `${num(v, 2)} h` },
  { key: "distance_km", label: "Distance", fmt: (v) => `${num(v, 0)} km` },
  { key: "soc_delta_pct", label: "SOC gain", fmt: (v) => `${num(v, 1)} pts` },
  { key: "charging_rate_kw", label: "Rate", fmt: (v) => `${num(v, 1)} kW` },
  { key: "cost_usd", label: "Cost", fmt: (v) => usd(v) },
];

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

  const total = segments.reduce((s, r) => s + r.n_sessions, 0);
  const maxOf = (key: keyof SegRow) =>
    Math.max(...segments.map((s) => (s[key] as number) ?? 0));
  const maxes = Object.fromEntries(
    METRICS.map((m) => [m.key, maxOf(m.key)]),
  ) as Record<string, number>;

  return (
    <>
      <PageHeader
        title="Session Segments"
        description="K-Means over six behavioural features. The silhouette score is about 0.12, so these are descriptive slices of one continuum, not sharply separated personas."
      />

      <div className="grid gap-4 md:grid-cols-2">
        {segments.map((seg, i) => {
          const color = CLUSTER_COLORS[i % CLUSTER_COLORS.length];
          return (
            <Reveal key={seg.cluster} delay={i * 60}>
              <Card className="relative h-full overflow-hidden">
                <DotField accentStroke={color} focus="88% 12%" />
                <CardHeader
                  className="relative z-10"
                  action={
                    <Badge tone="primary">
                      {num((seg.n_sessions / total) * 100, 0)}%
                    </Badge>
                  }
                >
                  <CardTitle className="flex items-center gap-2">
                    <span
                      className="size-2 rounded-full"
                      style={{ background: color }}
                      aria-hidden
                    />
                    {seg.archetype ?? `Cluster ${seg.cluster}`}
                  </CardTitle>
                  <p className="nums text-xs text-muted-foreground">
                    {num(seg.n_sessions)} sessions
                  </p>
                </CardHeader>
                <CardContent className="relative z-10 space-y-2.5">
                  {METRICS.map((m) => {
                    const v = (seg[m.key] as number | null) ?? 0;
                    const frac = maxes[m.key] ? v / maxes[m.key] : 0;
                    return (
                      <div
                        key={m.key}
                        className="grid grid-cols-[4.5rem_1fr_5rem] items-center gap-3"
                      >
                        <span className="text-xs text-muted-foreground">
                          {m.label}
                        </span>
                        <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <span
                            className="block h-full rounded-full"
                            style={{
                              width: `${Math.max(4, frac * 100)}%`,
                              background: color,
                            }}
                          />
                        </span>
                        <span className="nums text-right text-xs font-medium tabular-nums">
                          {m.fmt(seg[m.key] as number | null)}
                        </span>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </Reveal>
          );
        })}
      </div>

      <SectionTitle>All clusters</SectionTitle>
      <Reveal>
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Archetype</TH>
                <TH className="text-right">Sessions</TH>
                {METRICS.map((m) => (
                  <TH key={m.key} className="text-right">
                    {m.label}
                  </TH>
                ))}
              </TR>
            </THead>
            <TBody>
              {segments.map((seg) => (
                <TR key={seg.cluster}>
                  <TD className="font-medium text-foreground">
                    {seg.archetype ?? `Cluster ${seg.cluster}`}
                  </TD>
                  <TD num>{num(seg.n_sessions)}</TD>
                  {METRICS.map((m) => (
                    <TD key={m.key} num>
                      {m.fmt(seg[m.key] as number | null)}
                    </TD>
                  ))}
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
      </Reveal>
    </>
  );
}
