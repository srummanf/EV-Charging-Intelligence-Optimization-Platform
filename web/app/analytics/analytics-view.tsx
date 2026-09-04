"use client";

import { useState } from "react";
import type { HourRow, LocationRow, Overview, Patterns } from "@/lib/types";
import { num, usd } from "@/lib/utils";
import { BarChartCard } from "@/components/charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Stat, StatGrid } from "@/components/stat";
import { MetricPanel, MetricStats } from "@/components/ui/metric-panel";
import { DotField } from "@/components/ui/metric-visuals";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const pad = (h: number) => String(h).padStart(2, "0");
const n0 = (v: number | null | undefined) => num(v, 0);
const n1 = (v: number | null | undefined) => num(v, 1);
const n2 = (v: number | null | undefined) => num(v, 2);

interface MetricDef<T> {
  label: string;
  get: (r: T) => number | null | undefined;
  fmt: (v: number | null | undefined) => string;
  chartUnit?: string;
}

function Breakdown<T>({
  rows,
  dimName,
  dim,
  dimShort,
  metrics,
  note,
}: {
  rows: T[];
  dimName: string;
  dim: (r: T) => string;
  dimShort: (r: T) => string;
  metrics: MetricDef<T>[];
  note?: string;
}) {
  const [active, setActive] = useState(metrics[0].label);
  const m = metrics.find((x) => x.label === active) ?? metrics[0];
  const chartData = rows.map((r) => ({
    x: dimShort(r),
    v: Number(m.get(r) ?? 0),
  }));

  return (
    <div className="grid items-start gap-4 lg:grid-cols-5">
      <Card className="relative overflow-hidden lg:col-span-3 lg:self-start">
        <DotField accentStroke="var(--chart-1)" focus="78% 22%" />
        <CardHeader className="relative z-10 bg-transparent">
          <CardTitle>{dimName} breakdown</CardTitle>
        </CardHeader>
        <CardContent className="relative z-10 space-y-4 pt-5">
          <ToggleGroup
            type="single"
            value={active}
            onValueChange={(v) => v && setActive(v)}
            className="h-auto flex-wrap"
          >
            {metrics.map((x) => (
              <ToggleGroupItem key={x.label} value={x.label}>
                {x.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <BarChartCard
            data={chartData}
            xKey="x"
            series={[{ key: "v", name: m.label }]}
            unit={m.chartUnit}
            height={260}
          />
          {note ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {note}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2 lg:self-start">
        <CardContent className="p-0">
          <ScrollArea className="max-h-[26rem]">
            <Table>
              <THead>
                <TR>
                  <TH>{dimName}</TH>
                  {metrics.map((x) => (
                    <TH key={x.label} className="text-right">
                      {x.label}
                    </TH>
                  ))}
                </TR>
              </THead>
              <TBody>
                {rows.map((r, i) => (
                  <TR key={i}>
                    <TD className="font-medium text-foreground">{dim(r)}</TD>
                    {metrics.map((x) => (
                      <TD
                        key={x.label}
                        num
                        className={
                          x.label === active
                            ? "text-foreground"
                            : "text-muted-foreground"
                        }
                      >
                        {x.fmt(x.get(r))}
                      </TD>
                    ))}
                  </TR>
                ))}
              </TBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

export function AnalyticsView({
  patterns,
  locations,
  overview,
}: {
  patterns: Patterns;
  locations: LocationRow[];
  overview: Overview;
}) {
  const wd = patterns.weekend_vs_weekday.weekday;
  const we = patterns.weekend_vs_weekday.weekend;
  const totalWk = wd.sessions + we.sessions || 1;
  const weekendShare = (we.sessions / totalWk) * 100;

  const byEnergy = (a: HourRow, b: HourRow) =>
    (b.total_energy_kwh ?? 0) - (a.total_energy_kwh ?? 0);
  const peak = [...patterns.by_hour].sort(byEnergy)[0];

  const topCity = [...locations].sort(
    (a, b) => (b.total_energy_kwh ?? 0) - (a.total_energy_kwh ?? 0),
  )[0];
  const cityEnergyTotal =
    locations.reduce((s, l) => s + (l.total_energy_kwh ?? 0), 0) || 1;

  const topCharger = [...patterns.by_charger_type].sort(
    (a, b) => b.sessions - a.sessions,
  )[0];

  return (
    <div className="space-y-9">
      <StatGrid className="grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
        <Stat
          label="Sessions"
          value={num(overview.n_sessions)}
          emphasis
          hint={`${overview.n_vehicle_models} models, ${overview.n_locations} cities`}
        />
        <Stat
          label="Energy / session"
          value={num(overview.mean_energy_kwh, 1)}
          unit="kWh"
          emphasis
          hint={`${num(overview.median_energy_kwh, 1)} kWh median`}
        />
        <Stat
          label="Busiest hour"
          value={`${pad(peak.hour)}:00`}
          emphasis
          hint={`${num(peak.total_energy_kwh, 0)} kWh delivered`}
        />
        <Stat
          label="Weekend share"
          value={`${num(weekendShare, 0)}%`}
          emphasis
          hint={`${num(we.sessions)} of ${num(totalWk)} sessions`}
          tip="Share of sessions that started on Saturday or Sunday."
        />
        <Stat
          label="Top city"
          value={topCity.location}
          hint={`${num(((topCity.total_energy_kwh ?? 0) / cityEnergyTotal) * 100, 0)}% of energy`}
        />
        <Stat
          label="Top charger"
          value={topCharger.charger_type}
          hint={`${num(topCharger.sessions)} sessions`}
        />
      </StatGrid>

      <section>
        <h2 className="mb-3 text-[0.9375rem] font-semibold tracking-tight">
          Weekday and weekend
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <MetricPanel
            label="Weekday"
            sublabel="Monday to Friday"
            accent="blue"
            size="sm"
            value={num(wd.sessions)}
            unit="sessions"
            footerPrimary={`${num(wd.mean_energy_kwh, 1)} kWh / session`}
            footerSecondary={
              <MetricStats
                items={[
                  [num(wd.mean_duration_hours, 2), "h"],
                  [usd(wd.mean_cost_usd), "avg"],
                ]}
              />
            }
          />
          <MetricPanel
            label="Weekend"
            sublabel="Saturday and Sunday"
            accent="amber"
            size="sm"
            value={num(we.sessions)}
            unit="sessions"
            footerPrimary={`${num(we.mean_energy_kwh, 1)} kWh / session`}
            footerSecondary={
              <MetricStats
                items={[
                  [num(we.mean_duration_hours, 2), "h"],
                  [usd(we.mean_cost_usd), "avg"],
                ]}
              />
            }
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[0.9375rem] font-semibold tracking-tight">
          Breakdowns
        </h2>
        <Tabs defaultValue="hour">
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="hour">Time of day</TabsTrigger>
            <TabsTrigger value="weekday">Weekday</TabsTrigger>
            <TabsTrigger value="charger">Charger</TabsTrigger>
            <TabsTrigger value="vehicle">Vehicle</TabsTrigger>
            <TabsTrigger value="city">City</TabsTrigger>
          </TabsList>

          <TabsContent value="hour">
            <Breakdown
              rows={patterns.by_hour}
              dimName="Hour"
              dim={(r) => `${pad(r.hour)}:00`}
              dimShort={(r) => pad(r.hour)}
              note="This dataset places one session in every hour slot, so session counts are constant across the day. Only the energy each session drew varies."
              metrics={[
                {
                  label: "Total energy",
                  get: (r) => r.total_energy_kwh,
                  fmt: n0,
                  chartUnit: "kWh",
                },
                {
                  label: "Mean energy",
                  get: (r) => r.mean_energy_kwh,
                  fmt: n1,
                  chartUnit: "kWh",
                },
                { label: "Sessions", get: (r) => r.sessions, fmt: n0 },
              ]}
            />
          </TabsContent>

          <TabsContent value="weekday">
            <Breakdown
              rows={patterns.by_weekday}
              dimName="Day"
              dim={(r) => r.day_name}
              dimShort={(r) => r.day_name.slice(0, 3)}
              metrics={[
                { label: "Sessions", get: (r) => r.sessions, fmt: n0 },
                {
                  label: "Mean energy",
                  get: (r) => r.mean_energy_kwh,
                  fmt: n1,
                  chartUnit: "kWh",
                },
                {
                  label: "Mean cost",
                  get: (r) => r.mean_cost_usd,
                  fmt: (v) => usd(v),
                  chartUnit: "USD",
                },
              ]}
            />
          </TabsContent>

          <TabsContent value="charger">
            <Breakdown
              rows={patterns.by_charger_type}
              dimName="Charger"
              dim={(r) => r.charger_type}
              dimShort={(r) => r.charger_type.replace(" Charger", "")}
              metrics={[
                { label: "Sessions", get: (r) => r.sessions, fmt: n0 },
                {
                  label: "Mean energy",
                  get: (r) => r.mean_energy_kwh,
                  fmt: n1,
                  chartUnit: "kWh",
                },
                {
                  label: "Duration",
                  get: (r) => r.mean_duration_hours,
                  fmt: n2,
                  chartUnit: "h",
                },
                {
                  label: "Rate",
                  get: (r) => r.mean_charging_rate_kw,
                  fmt: n1,
                  chartUnit: "kW",
                },
                {
                  label: "Mean cost",
                  get: (r) => r.mean_cost_usd,
                  fmt: (v) => usd(v),
                  chartUnit: "USD",
                },
              ]}
            />
          </TabsContent>

          <TabsContent value="vehicle">
            <Breakdown
              rows={patterns.by_vehicle_model}
              dimName="Model"
              dim={(r) => r.vehicle_model}
              dimShort={(r) => r.vehicle_model.replace("Model ", "")}
              note="The five models have near-identical energy profiles in this data, a side effect of how the dataset was generated."
              metrics={[
                { label: "Sessions", get: (r) => r.sessions, fmt: n0 },
                {
                  label: "Mean energy",
                  get: (r) => r.mean_energy_kwh,
                  fmt: n1,
                  chartUnit: "kWh",
                },
                {
                  label: "Battery",
                  get: (r) => r.mean_battery_capacity_kwh,
                  fmt: n1,
                  chartUnit: "kWh",
                },
                {
                  label: "Distance",
                  get: (r) => r.mean_distance_km,
                  fmt: n0,
                  chartUnit: "km",
                },
              ]}
            />
          </TabsContent>

          <TabsContent value="city">
            <Breakdown
              rows={locations}
              dimName="City"
              dim={(r) => r.location}
              dimShort={(r) => r.location}
              metrics={[
                { label: "Sessions", get: (r) => r.sessions, fmt: n0 },
                { label: "Stations", get: (r) => r.n_stations, fmt: n0 },
                {
                  label: "Total energy",
                  get: (r) => r.total_energy_kwh,
                  fmt: n0,
                  chartUnit: "kWh",
                },
                {
                  label: "Mean energy",
                  get: (r) => r.mean_energy_kwh,
                  fmt: n1,
                  chartUnit: "kWh",
                },
                {
                  label: "Mean cost",
                  get: (r) => r.mean_cost_usd,
                  fmt: (v) => usd(v),
                  chartUnit: "USD",
                },
              ]}
            />
          </TabsContent>
        </Tabs>
      </section>

      <Card>
        <CardContent className="py-0.5">
          <Accordion type="single" collapsible>
            <AccordionItem value="compute">
              <AccordionTrigger>
                How the breakdowns are computed
              </AccordionTrigger>
              <AccordionContent>
                Grouped from the cleaned session table by
                <span className="text-foreground">
                  {" "}
                  evcharging.analytics.aggregate
                </span>
                . Duration is derived from the start and end timestamps, not the
                unreliable reported column. Means exclude rows where the
                underlying field is missing.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="flat">
              <AccordionTrigger>Why time of day looks flat</AccordionTrigger>
              <AccordionContent>
                The source data assigns exactly one session to each hour slot, so
                session counts per hour are constant by construction. The energy
                each session drew still varies, which is what the Total energy
                and Mean energy measures show.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="synthetic">
              <AccordionTrigger>Synthetic-data caveats</AccordionTrigger>
              <AccordionContent>
                Pricing and the near-identical vehicle profiles are artifacts of
                a dataset generated column by column. The platform reports what is
                in the data rather than smoothing it. See the project README and
                results/FINDINGS.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
