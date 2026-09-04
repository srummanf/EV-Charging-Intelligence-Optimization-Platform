import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BatteryCharging,
  Clock,
  DollarSign,
  MapPin,
  Plug,
  Zap,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { num, usd } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Stat, StatGrid, MiniBar } from "@/components/stat";
import { ApiErrorCard } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkline } from "@/components/charts";
import { Reveal, CountUp } from "@/components/motion";
import ProgressMetricCard from "@/components/ui/progress-metric-card";
import { MetricPanel, MetricStats } from "@/components/ui/metric-panel";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

export const dynamic = "force-dynamic";

const pad = (h: number) => String(h).padStart(2, "0");

export default async function OverviewPage() {
  let overview, health, forecast, segments;
  try {
    [overview, health, forecast, segments] = await Promise.all([
      api.overview(),
      api.health(),
      api.forecast(24),
      api.segments(),
    ]);
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <>
          <PageHeader title="Network Overview" />
          <ApiErrorCard message={error.message} />
        </>
      );
    }
    throw error;
  }

  const dq = overview.data_quality;
  const flaggedFrac = dq.pct_sessions_flagged / 100;

  const loadSeries = forecast.history.map((h) => ({
    value: h.energy_kwh,
    date: `${h.timestamp.slice(5, 10)} ${h.timestamp.slice(11, 13)}h`,
  }));
  const recent24 = forecast.history.slice(-24);
  const recentMean = recent24.length
    ? recent24.reduce((s, h) => s + h.energy_kwh, 0) / recent24.length
    : 0;
  const loadVsBaseline = forecast.baseline_mean_kwh
    ? ((recentMean - forecast.baseline_mean_kwh) / forecast.baseline_mean_kwh) *
      100
    : 0;

  const fPoints = forecast.points;
  const fMean = fPoints.length
    ? fPoints.reduce((s, p) => s + p.predicted_energy_kwh, 0) / fPoints.length
    : 0;
  const fPeak =
    [...fPoints].sort(
      (a, b) => b.predicted_energy_kwh - a.predicted_energy_kwh,
    )[0] ?? { predicted_energy_kwh: 0, hour: 0 };
  const fDelta = forecast.baseline_mean_kwh
    ? ((fMean - forecast.baseline_mean_kwh) / forecast.baseline_mean_kwh) * 100
    : 0;
  const spark = fPoints.map((p) => ({ h: p.hour, kwh: p.predicted_energy_kwh }));

  const segTotal = segments.reduce((s, r) => s + r.n_sessions, 0) || 1;
  const segMaxShare =
    Math.max(...segments.map((s) => s.n_sessions / segTotal)) || 1;
  const genAt =
    health.analytics_generated_at
      ?.replace("T", " ")
      .replace(/\+.*/, "")
      .replace(/\.\d+$/, "") ?? "unknown";

  const secondary = [
    { label: "Avg rate", value: `${num(overview.mean_charging_rate_kw, 1)} kW` },
    { label: "Peak hour", value: `${pad(overview.peak_hour)}:00` },
    { label: "Top charger", value: overview.most_used_charger_type },
    {
      label: "Highest demand",
      value: overview.highest_demand_location,
      icon: <MapPin className="size-3.5" />,
    },
  ];

  return (
    <div className="space-y-12 sm:space-y-16">
      {/* Command header */}
      <section className="relative -mx-4 overflow-hidden px-4 pt-1 sm:-mx-6 sm:px-6 sm:pt-2">
        <div
          aria-hidden
          data-parallax
          className="pointer-events-none absolute -top-40 left-0 -z-10 h-[420px] w-[680px] max-w-[85vw] rounded-full opacity-50 blur-[120px] will-change-transform"
          style={{
            background:
              "radial-gradient(circle, color-mix(in oklab, var(--primary) 38%, transparent), transparent 70%)",
          }}
        />

        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <Reveal className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <Badge tone={health.status === "ok" ? "normal" : "high"} dot>
                <span className="live-dot">API {health.status}</span>
              </Badge>
              <span>
                {health.models_loaded.length} models loaded, analytics {genAt}
              </span>
            </Reveal>

            <Reveal>
              <h1 className="mt-5 text-[1.9rem] font-semibold leading-[1.08] tracking-[-0.02em] text-balance sm:text-4xl lg:text-[2.6rem]">
                Every charging session measured, not estimated.
              </h1>
            </Reveal>

            <Reveal>
              <p className="mt-5 text-[0.95rem] leading-relaxed text-muted-foreground">
                A live console over the full session history: demand patterns,
                24-hour forecasts, behavioural segments, and a physical-consistency
                monitor that flags bad rows instead of hiding them.
              </p>
            </Reveal>

            <Reveal className="mt-7 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/forecast">
                  View the forecast
                  <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/anomalies">Anomaly monitor</Link>
              </Button>
            </Reveal>
          </div>

          <Reveal className="w-full shrink-0 lg:mt-1 lg:w-72">
            <div className="divide-y divide-border overflow-hidden rounded-[20px] border bg-card/70">
              <p className="px-4 py-2.5 text-xs font-medium text-muted-foreground">
                Watchlist
              </p>
              <SignalRow
                href="/forecast"
                label="Forecast, next 24h"
                value={`${num(fMean, 1)} kWh/h`}
                delta={`${fDelta >= 0 ? "+" : ""}${num(fDelta, 1)}% vs baseline`}
                deltaTone={fDelta >= 0 ? "warning" : "success"}
              />
              <SignalRow
                href="/anomalies"
                label="Sessions flagged"
                value={`${num(dq.pct_sessions_flagged, 1)}%`}
                delta={`${num(dq.n_sessions_flagged)} of ${num(overview.n_sessions)}`}
                deltaTone="danger"
              />
              <SignalRow
                href="/segments"
                label="Behaviour clusters"
                value={`${segments.length}`}
                delta="archetypes, silhouette 0.12"
                deltaTone="muted"
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Network at a glance */}
      <section>
        <Reveal className="mb-4">
          <h2 className="text-[0.9375rem] font-semibold tracking-tight">
            Network at a glance
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {num(overview.n_sessions)} sessions across {overview.n_stations}{" "}
            stations in {overview.n_locations} cities, {overview.date_start} to{" "}
            {overview.date_end}
          </p>
        </Reveal>

        <Reveal delay={60}>
          <StatGrid className="grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Sessions"
              value={<CountUp value={overview.n_sessions} />}
              icon={<Zap className="size-3.5" />}
              emphasis
              hint={`${overview.n_vehicle_models} vehicle models`}
              tip="Every row in the cleaned session table, one charge per row."
            />
            <Stat
              label="Energy delivered"
              value={<CountUp value={overview.total_energy_kwh / 1000} decimals={1} />}
              unit="MWh"
              icon={<BatteryCharging className="size-3.5" />}
              emphasis
              hint={`${num(overview.mean_energy_kwh, 1)} kWh avg / session`}
              tip="Sum of reported Energy Consumed (kWh) across all sessions."
            />
            <Stat
              label="Revenue"
              value={
                <CountUp
                  value={overview.total_cost_usd / 1000}
                  decimals={1}
                  prefix="$"
                  suffix="k"
                />
              }
              icon={<DollarSign className="size-3.5" />}
              emphasis
              hint={`${usd(overview.mean_cost_usd)} avg / session`}
              tip="Sum of reported charging cost. The dataset's pricing is synthetic."
            />
            <Stat
              label="Avg session"
              value={<CountUp value={overview.mean_duration_hours} decimals={2} />}
              unit="h"
              icon={<Clock className="size-3.5" />}
              emphasis
              hint={`+${num(overview.mean_soc_increase_pct, 0)} pts SOC`}
              tip="Mean duration derived from start and end timestamps, not the unreliable reported column."
            />
          </StatGrid>
        </Reveal>

        <Reveal
          delay={120}
          className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-[18px] border bg-card/60 px-4 py-3"
        >
          {secondary.map((f, i) => (
            <div key={f.label} className="flex items-center gap-x-6">
              {i > 0 ? (
                <span className="hidden h-4 w-px bg-border sm:block" aria-hidden />
              ) : null}
              <span className="flex items-baseline gap-1.5 text-sm">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  {f.icon}
                  {f.label}
                </span>
                <span className="font-medium tracking-tight">{f.value}</span>
              </span>
            </div>
          ))}
        </Reveal>
      </section>

      {/* Demand and data health */}
      <section>
        <Reveal>
          <h2 className="mb-4 text-[0.9375rem] font-semibold tracking-tight">
            Demand and data health
          </h2>
        </Reveal>

        <div className="grid items-stretch gap-4 lg:grid-cols-3">
          <Reveal className="lg:col-span-2">
            <ProgressMetricCard
              title="Energy delivered"
              unit="kWh"
              size="md"
              accent="blue"
              className="h-full"
              period="Past 24 hours"
              periodOptions={[
                { label: "Past 12 hours", points: 12 },
                { label: "Past 24 hours", points: 24 },
                { label: "Past 72 hours" },
              ]}
              defaultView="curve"
              percent={`${Math.abs(loadVsBaseline).toFixed(1)}%`}
              trend={loadVsBaseline >= 0 ? "up" : "down"}
              delta={`${num(recentMean, 1)} kWh/h`}
              deltaLabel="recent hourly average"
              data={loadSeries}
            />
          </Reveal>

          <Reveal delay={80} className="flex flex-col gap-4">
            <MetricPanel
              label="Data quality"
              sublabel="Physical-consistency validation"
              accent="rose"
              size="sm"
              className="flex-1"
              value={
                <CountUp value={dq.pct_sessions_flagged} decimals={1} suffix="%" />
              }
              action={
                <Link
                  href="/anomalies"
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Monitor
                </Link>
              }
              footerPrimary={`${num(dq.n_sessions_flagged)} flagged`}
              footerSecondary={
                <MetricStats
                  items={[
                    [num(overview.n_sessions - dq.n_sessions_flagged), "clean"],
                    ["5", "rules"],
                  ]}
                />
              }
            >
              <MiniBar value={flaggedFrac} tone="danger" />
              <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
                Synthetic rows rarely agree across duration, rate and energy. The
                platform <span className="text-foreground">measures</span> the
                inconsistency instead of hiding it.
              </p>
            </MetricPanel>

            <MetricPanel
              label="Next 24 hours"
              sublabel="Forecast mean vs history"
              accent="blue"
              size="sm"
              className="flex-1"
              value={<CountUp value={fMean} decimals={1} />}
              unit="kWh/h"
              action={
                <Badge tone={fDelta >= 0 ? "medium" : "normal"}>
                  {fDelta >= 0 ? "+" : ""}
                  {num(fDelta, 1)}%
                </Badge>
              }
              bleed={<Sparkline data={spark} dataKey="kwh" height="100%" />}
              bleedWidth={66}
              footerPrimary={`${num(fPeak.predicted_energy_kwh, 1)} kWh peak`}
              footerSecondary={
                <>
                  <span>at {pad(fPeak.hour)}:00</span>
                  <span className="opacity-40">/</span>
                  <Link
                    href="/forecast"
                    className="pointer-events-auto font-medium text-primary hover:underline"
                  >
                    full forecast
                  </Link>
                </>
              }
            />
          </Reveal>
        </div>
      </section>

      {/* Behaviour clusters */}
      <section className="grid gap-x-10 gap-y-6 lg:grid-cols-[minmax(0,15rem)_1fr]">
        <Reveal className="lg:sticky lg:top-24 lg:self-start">
          <h2 className="text-lg font-semibold tracking-tight">
            Where the behaviour clusters
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            K-Means over six session features. The silhouette score is about
            0.12, so these are descriptive slices of one continuum, not sharp
            personas.
          </p>
          <Link
            href="/segments"
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Full segment breakdown
            <ArrowRight className="size-4" />
          </Link>
        </Reveal>

        <div className="grid gap-4 sm:grid-cols-2">
          {segments.map((seg, i) => {
            const share = (seg.n_sessions / segTotal) * 100;
            const wide =
              segments.length % 2 === 1 && i === segments.length - 1;
            const detail: [string, string][] = [
              ["Energy", `${num(seg.energy_kwh, 1)} kWh`],
              ["Duration", `${num(seg.duration_hours, 2)} h`],
              ["Distance", `${num(seg.distance_km, 0)} km`],
              ["SOC gain", `${num(seg.soc_delta_pct, 1)} pts`],
              ["Rate", `${num(seg.charging_rate_kw, 1)} kW`],
              ["Cost", usd(seg.cost_usd)],
            ];
            return (
              <Reveal
                key={seg.cluster}
                delay={i * 60}
                className={wide ? "sm:col-span-2" : undefined}
              >
                <HoverCard>
                  <HoverCardTrigger asChild>
                    <div className="h-full cursor-default">
                      <MetricPanel
                        label={seg.archetype ?? `Cluster ${seg.cluster}`}
                        sublabel={`${num(seg.n_sessions)} sessions`}
                        accent="blue"
                        size="sm"
                        className="h-full"
                        value={`${num(share, 0)}%`}
                        footerPrimary={`${num(seg.soc_delta_pct, 0)} pts SOC`}
                        footerSecondary={
                          <MetricStats
                            items={[
                              [num(seg.energy_kwh, 1), "kWh"],
                              [num(seg.duration_hours, 2), "h"],
                              [num(seg.charging_rate_kw, 1), "kW"],
                            ]}
                          />
                        }
                      >
                        <MiniBar value={share / 100 / segMaxShare} />
                        <p className="mt-2 text-xs text-muted-foreground">
                          {num(seg.distance_km, 0)} km typical range
                        </p>
                      </MetricPanel>
                    </div>
                  </HoverCardTrigger>
                  <HoverCardContent>
                    <p className="text-sm font-semibold tracking-tight">
                      {seg.archetype ?? `Cluster ${seg.cluster}`}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {num(share, 0)}% of sessions. One of {segments.length}{" "}
                      K-Means slices at silhouette 0.12, so read it as a
                      tendency, not a hard group.
                    </p>
                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                      {detail.map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-2">
                          <dt className="text-muted-foreground">{k}</dt>
                          <dd className="nums font-medium text-foreground">
                            {v}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </HoverCardContent>
                </HoverCard>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* Driver view */}
      <Reveal
        as="section"
        className="relative overflow-hidden rounded-[24px] bg-primary px-6 py-10 text-primary-foreground sm:px-10 sm:py-12"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "radial-gradient(currentColor 0.6px, transparent 0.6px)",
            backgroundSize: "22px 22px",
          }}
        />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <div className="flex items-center gap-2 text-sm font-medium text-primary-foreground/80">
              <Plug className="size-4" />
              Driver view
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
              Plan a charge from the driver&apos;s seat
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-primary-foreground/80">
              Enter a car, a target state of charge and a time budget. Get a
              charger recommendation with modelled energy, duration and cost,
              plus a three-charger comparison.
            </p>
          </div>
          <Button
            asChild
            size="lg"
            variant="secondary"
            className="shrink-0 self-start sm:self-auto"
          >
            <Link href="/my-charging">
              Open My Charging
              <ArrowUpRight />
            </Link>
          </Button>
        </div>
      </Reveal>
    </div>
  );
}

const SIGNAL_TONE = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  muted: "text-muted-foreground",
} as const;

function SignalRow({
  href,
  label,
  value,
  delta,
  deltaTone,
}: {
  href: string;
  label: string;
  value: string;
  delta: string;
  deltaTone: keyof typeof SIGNAL_TONE;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-accent"
    >
      <div className="min-w-0">
        <div className="truncate text-xs text-muted-foreground">{label}</div>
        <div className={`mt-0.5 text-[0.6875rem] ${SIGNAL_TONE[deltaTone]}`}>
          {delta}
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="nums text-sm font-semibold tabular-nums">{value}</span>
        <ArrowUpRight className="size-3.5 text-muted-foreground/50 transition-colors group-hover:text-primary" />
      </div>
    </Link>
  );
}
