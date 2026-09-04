"use client";

import { useState } from "react";
import { Loader2, Zap } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { Recommendation, RecommendationInput } from "@/lib/types";
import { USER_TYPES, VEHICLE_MODELS } from "@/lib/types";
import { num, usd } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Fieldset, Input, Select } from "@/components/ui/field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";

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

  function set<K extends keyof RecommendationInput>(key: K, value: RecommendationInput[K]) {
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
    <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
      <Card>
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

            <Fieldset label="Battery capacity (kWh)" htmlFor="cap">
              <Input
                id="cap"
                type="number"
                min={10}
                max={250}
                value={form.battery_capacity_kwh}
                onChange={(e) => set("battery_capacity_kwh", Number(e.target.value))}
              />
            </Fieldset>

            <div className="grid grid-cols-2 gap-3">
              <Fieldset label="SOC now (%)" htmlFor="s0">
                <Input
                  id="s0"
                  type="number"
                  min={0}
                  max={100}
                  value={form.soc_start_pct}
                  onChange={(e) => set("soc_start_pct", Number(e.target.value))}
                />
              </Fieldset>
              <Fieldset label="SOC target (%)" htmlFor="s1">
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

            <Fieldset label="Distance since last charge (km)" htmlFor="dist">
              <Input
                id="dist"
                type="number"
                min={0}
                value={form.distance_km}
                onChange={(e) => set("distance_km", Number(e.target.value))}
              />
            </Fieldset>

            <div className="grid grid-cols-2 gap-3">
              <Fieldset label="Earliest start (hour)" htmlFor="eh">
                <Input
                  id="eh"
                  type="number"
                  min={0}
                  max={23}
                  value={form.earliest_hour}
                  onChange={(e) => set("earliest_hour", Number(e.target.value))}
                />
              </Fieldset>
              <Fieldset label="Hours available" htmlFor="ha">
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

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              Get recommendation
            </Button>
          </form>
        </CardContent>
      </Card>

      <div>
        {error && (
          <Card className="border-critical/30 bg-critical/5">
            <CardContent className="pt-5 text-sm text-text-secondary">{error}</CardContent>
          </Card>
        )}

        {result && !error && <RecommendationCard rec={result} />}

        {!result && !error && (
          <div className="flex h-full min-h-64 items-center justify-center rounded-xl border border-dashed text-sm text-text-muted">
            Fill in your charge and submit to see a recommended plan.
          </div>
        )}
      </div>
    </div>
  );
}

function RecommendationCard({ rec }: { rec: Recommendation }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Recommended plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-2xl font-semibold text-text-primary">
              {rec.recommended_charger}
            </span>
            <Badge tone="info">start {rec.charging_window}</Badge>
          </div>

          <div className="grid grid-cols-3 gap-3 text-sm">
            <Metric label="Energy" value={`${num(rec.estimated_energy_kwh, 1)} kWh`} />
            <Metric label="Time" value={`${num(rec.estimated_duration_hours, 2)} h`} />
            <Metric label="Cost" value={usd(rec.estimated_cost_usd)} />
          </div>

          <p className="text-sm text-text-secondary">{rec.reason}</p>

          {rec.session_archetype && (
            <p className="text-xs text-text-muted">
              Closest session archetype: {rec.session_archetype}
            </p>
          )}

          {rec.notes.length > 0 && (
            <ul className="space-y-1 rounded-md bg-surface-2 p-3 text-xs text-text-secondary">
              {rec.notes.map((n, i) => (
                <li key={i}>• {n}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Compare charger types</CardTitle>
        </CardHeader>
        <CardContent>
          <Table className="tabular">
            <THead>
              <TR>
                <TH>Charger</TH>
                <TH>Power</TH>
                <TH>Time</TH>
                <TH>Cost</TH>
                <TH>Fits budget</TH>
              </TR>
            </THead>
            <tbody>
              {rec.options.map((o) => (
                <TR key={o.charger_type}>
                  <TD className="font-medium text-text-primary">{o.charger_type}</TD>
                  <TD>{num(o.power_kw, 1)} kW</TD>
                  <TD>{num(o.duration_hours, 2)} h</TD>
                  <TD>{usd(o.cost_usd)}</TD>
                  <TD>
                    <Badge tone={o.fits_time_budget ? "normal" : "medium"}>
                      {o.fits_time_budget ? "yes" : "no"}
                    </Badge>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="tabular text-base font-semibold text-text-primary">{value}</p>
    </div>
  );
}
