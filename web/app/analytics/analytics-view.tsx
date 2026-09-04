"use client";

import type { LocationRow, Patterns } from "@/lib/types";
import { num, usd } from "@/lib/utils";
import { BarChartCard } from "@/components/charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";

const TABS = [
  { value: "time", label: "Time of day" },
  { value: "weekday", label: "Weekday" },
  { value: "charger", label: "Charger type" },
  { value: "vehicle", label: "Vehicle" },
  { value: "location", label: "Location" },
];

export function AnalyticsView({
  patterns,
  locations,
}: {
  patterns: Patterns;
  locations: LocationRow[];
}) {
  return (
    <Tabs tabs={TABS}>
      {(active) => {
        if (active === "time")
          return (
            <ChartCard
              title="Mean energy per session by hour"
              note="Sessions per hour are constant on this dataset (one per hour); energy varies only within noise."
            >
              <BarChartCard
                data={patterns.by_hour.map((r) => ({
                  hour: `${String(r.hour).padStart(2, "0")}h`,
                  "Mean energy": r.mean_energy_kwh,
                }))}
                xKey="hour"
                series={[{ key: "Mean energy", name: "Mean energy (kWh)" }]}
                unit="kWh"
              />
            </ChartCard>
          );

        if (active === "weekday")
          return (
            <ChartCard title="Sessions and mean energy by weekday">
              <BarChartCard
                data={patterns.by_weekday.map((r) => ({
                  day: r.day_name.slice(0, 3),
                  Sessions: r.sessions,
                }))}
                xKey="day"
                series={[{ key: "Sessions", name: "Sessions" }]}
              />
            </ChartCard>
          );

        if (active === "charger")
          return (
            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard title="Sessions by charger type">
                <BarChartCard
                  data={patterns.by_charger_type.map((r) => ({
                    charger: r.charger_type,
                    Sessions: r.sessions,
                  }))}
                  xKey="charger"
                  series={[{ key: "Sessions", name: "Sessions" }]}
                  height={260}
                />
              </ChartCard>
              <SimpleTable
                head={["Charger", "Sessions", "Energy", "Duration", "Cost"]}
                rows={patterns.by_charger_type.map((r) => [
                  r.charger_type,
                  num(r.sessions),
                  `${num(r.mean_energy_kwh, 1)} kWh`,
                  `${num(r.mean_duration_hours, 2)} h`,
                  usd(r.mean_cost_usd),
                ])}
              />
            </div>
          );

        if (active === "vehicle")
          return (
            <ChartCard
              title="Mean energy per session by vehicle model"
              note="The five models have near-identical energy profiles in this data."
            >
              <BarChartCard
                data={patterns.by_vehicle_model.map((r) => ({
                  model: r.vehicle_model.replace("Model ", ""),
                  "Mean energy": r.mean_energy_kwh,
                }))}
                xKey="model"
                series={[{ key: "Mean energy", name: "Mean energy (kWh)" }]}
                unit="kWh"
              />
            </ChartCard>
          );

        return (
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Total energy delivered by city">
              <BarChartCard
                data={locations.map((r) => ({
                  city: r.location,
                  "Total energy": r.total_energy_kwh,
                }))}
                xKey="city"
                series={[{ key: "Total energy", name: "Total energy (kWh)" }]}
                unit="kWh"
                height={260}
              />
            </ChartCard>
            <SimpleTable
              head={["City", "Sessions", "Stations", "Energy", "Avg cost"]}
              rows={locations.map((r) => [
                r.location,
                num(r.sessions),
                num(r.n_stations),
                `${num(r.total_energy_kwh)} kWh`,
                usd(r.mean_cost_usd),
              ])}
            />
          </div>
        );
      }}
    </Tabs>
  );
}

function ChartCard({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {children}
        {note ? <p className="mt-3 text-xs text-text-muted">{note}</p> : null}
      </CardContent>
    </Card>
  );
}

function SimpleTable({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <Table className="tabular">
          <THead>
            <TR>
              {head.map((h) => (
                <TH key={h}>{h}</TH>
              ))}
            </TR>
          </THead>
          <tbody>
            {rows.map((row, i) => (
              <TR key={i}>
                {row.map((cell, j) => (
                  <TD key={j}>{cell}</TD>
                ))}
              </TR>
            ))}
          </tbody>
        </Table>
      </CardContent>
    </Card>
  );
}
