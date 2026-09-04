"use client";

import { useState } from "react";
import {
  ArrowRight,
  BatteryCharging,
  Clock,
  DollarSign,
  Loader2,
  Sparkles,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { Recommendation, RecommendationInput } from "@/lib/types";
import { USER_TYPES, VEHICLE_MODELS } from "@/lib/types";
import { num, usd } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Fieldset, Input, Select } from "@/components/ui/field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { DotField } from "@/components/ui/metric-visuals";

const DEFAULTS: RecommendationInput = {
  vehicle_model: "Tesla Model 3",
  battery_capacity_kwh: 60,
  soc_start_pct: 30,
  soc_target_pct: 80,
  distance_km: 120,
  earliest_hour: 20,
  hours_available: 10,
  temperature_c: 20,
  user_type: "Commuter",
};

export function ChargingForm() {
  const [form, setForm] = useState<RecommendationInput>(DEFAULTS);
  const [result, setResult] = useState<Recommendation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function set<K extends keyof RecommendationInput>(
    key: K,
    value: RecommendationInput[K],
  ) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      setResult(await api.recommend(form));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Your charge</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <Fieldset label="Vehicle" htmlFor="vehicle">
              <Select
                id="vehicle"
                value={form.vehicle_model}
                onChange={(e) => set("vehicle_model", e.target.value)}
              >
                {VEHICLE_MODELS.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </Select>
            </Fieldset>

            <Fieldset label="Battery capacity" htmlFor="cap" hint="kWh">
              <Input
                id="cap"
                type="number"
                min={10}
                max={250}
                value={form.battery_capacity_kwh}
                onChange={(e) =>
                  set("battery_capacity_kwh", Number(e.target.value))
                }
              />
            </Fieldset>

            <div className="grid grid-cols-2 gap-3">
              <Fieldset label="SOC now" htmlFor="s0" hint="%">
                <Input
                  id="s0"
                  type="number"
                  min={0}
                  max={100}
                  value={form.soc_start_pct}
                  onChange={(e) => set("soc_start_pct", Number(e.target.value))}
                />
              </Fieldset>
              <Fieldset label="SOC target" htmlFor="s1" hint="%">
                <Input
                  id="s1"
                  type="number"
                  min={0}
                  max={100}
                  value={form.soc_target_pct}
                  onChange={(e) => set("soc_target_pct", Number(e.target.value))}
                />
              </Fieldset>
            </div>

            <Fieldset label="Distance since last charge" htmlFor="dist" hint="km">
              <Input
                id="dist"
                type="number"
                min={0}
                value={form.distance_km}
                onChange={(e) => set("distance_km", Number(e.target.value))}
              />
            </Fieldset>

            <div className="grid grid-cols-2 gap-3">
              <Fieldset label="Earliest start" htmlFor="eh" hint="hour 0-23">
                <Input
                  id="eh"
                  type="number"
                  min={0}
                  max={23}
                  value={form.earliest_hour}
                  onChange={(e) => set("earliest_hour", Number(e.target.value))}
                />
              </Fieldset>
              <Fieldset label="Time available" htmlFor="ha" hint="hours">
                <Input
                  id="ha"
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={form.hours_available}
                  onChange={(e) => set("hours_available", Number(e.target.value))}
                />
              </Fieldset>
            </div>

            <Fieldset label="Driver type" htmlFor="ut">
              <Select
                id="ut"
                value={form.user_type}
                onChange={(e) => set("user_type", e.target.value)}
              >
                {USER_TYPES.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </Select>
            </Fieldset>

            <Button type="submit" size="lg" disabled={loading} className="w-full">
              {loading ? (
                <Loader2 className="animate-spin" />
              ) : (
                <>
                  Get recommendation <ArrowRight />
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div>
        {error && (
          <div className="rounded-xl border border-danger/30 bg-danger/[0.04] p-4 text-sm text-muted-foreground">
            {error}
          </div>
        )}
        {result && !error && <RecommendationView rec={result} />}
        {!result && !error && (
          <EmptyState
            icon={<Sparkles className="size-5" />}
            title="No plan yet"
            message="Fill in your charge and submit to see a recommended plan."
          />
        )}
      </div>
    </div>
  );
}

function RecommendationView({ rec }: { rec: Recommendation }) {
  return (
    <div className="space-y-4">
      <Card className="relative overflow-hidden">
        <DotField accentStroke="var(--chart-1)" focus="90% 8%" />
        <CardContent className="relative z-10 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Recommended charger
              </p>
              <p className="font-display text-[1.85rem] font-semibold leading-tight tracking-tight">
                {rec.recommended_charger}
              </p>
            </div>
            <Badge tone="primary" className="text-sm">
              <Clock className="size-3.5" />
              start {rec.charging_window}
            </Badge>
          </div>

          <div className="grid grid-cols-3 divide-x divide-border overflow-hidden rounded-lg border bg-card">
            <BigMetric
              icon={<BatteryCharging className="size-3.5" />}
              label="Energy"
              value={num(rec.estimated_energy_kwh, 1)}
              unit="kWh"
            />
            <BigMetric
              icon={<Clock className="size-3.5" />}
              label="Time"
              value={num(rec.estimated_duration_hours, 2)}
              unit="h"
            />
            <BigMetric
              icon={<DollarSign className="size-3.5" />}
              label="Cost"
              value={usd(rec.estimated_cost_usd).replace("$", "")}
              unit="USD"
            />
          </div>

          <p className="text-sm leading-relaxed text-muted-foreground">
            {rec.reason}
          </p>

          {rec.session_archetype && (
            <p className="text-xs text-muted-foreground/80">
              Closest archetype:{" "}
              <span className="text-foreground">{rec.session_archetype}</span>
            </p>
          )}

          {rec.notes.length > 0 && (
            <>
              <Separator />
              <ul className="space-y-2 border-l pl-3 text-xs text-muted-foreground">
                {rec.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Compare charger types</CardTitle>
          <p className="text-xs text-muted-foreground">
            Same energy and cost. Only the time differs
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH className="pl-5">Charger</TH>
                <TH className="text-right">Power</TH>
                <TH className="text-right">Time</TH>
                <TH className="text-right">Cost</TH>
                <TH>Fits budget</TH>
              </TR>
            </THead>
            <TBody>
              {rec.options.map((o) => (
                <TR
                  key={o.charger_type}
                  data-state={
                    o.charger_type === rec.recommended_charger
                      ? "selected"
                      : undefined
                  }
                >
                  <TD className="pl-5 font-medium text-foreground">
                    {o.charger_type}
                  </TD>
                  <TD num>{num(o.power_kw, 1)} kW</TD>
                  <TD num>{num(o.duration_hours, 2)} h</TD>
                  <TD num>{usd(o.cost_usd)}</TD>
                  <TD>
                    <Badge
                      tone={o.fits_time_budget ? "normal" : "medium"}
                      dot
                    >
                      {o.fits_time_budget ? "yes" : "no"}
                    </Badge>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function BigMetric({
  icon,
  label,
  value,
  unit,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="space-y-1.5 p-3.5">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="font-display block text-[1.6rem] font-semibold leading-none tabular-nums tracking-tight">
        {value}
        <span className="ml-1 text-xs font-medium text-muted-foreground">
          {unit}
        </span>
      </span>
    </div>
  );
}
