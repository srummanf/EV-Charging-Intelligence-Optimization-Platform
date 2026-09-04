"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import type { AnomalyList, AnomalySession, Risk } from "@/lib/types";
import { num } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";

const RISK_TONE: Record<Risk, "high" | "medium" | "normal"> = {
  high: "high",
  medium: "medium",
  normal: "normal",
};
const RISK_FILTERS: ("all" | Risk)[] = ["all", "high", "medium", "normal"];

export function AnomaliesTable({ data }: { data: AnomalyList }) {
  const [risk, setRisk] = useState<"all" | Risk>("all");
  const [sortDesc, setSortDesc] = useState(true);
  const [selected, setSelected] = useState<AnomalySession | null>(null);

  const rows = useMemo(() => {
    const filtered = data.sessions.filter((s) => risk === "all" || s.risk === risk);
    return [...filtered].sort((a, b) =>
      sortDesc ? b.anomaly_score - a.anomaly_score : a.anomaly_score - b.anomaly_score,
    );
  }, [data.sessions, risk, sortDesc]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: data.sessions.length, high: 0, medium: 0, normal: 0 };
    for (const s of data.sessions) c[s.risk]++;
    return c;
  }, [data.sessions]);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {RISK_FILTERS.map((r) => (
          <button
            key={r}
            onClick={() => setRisk(r)}
            className={cn(
              "rounded-md border px-3 py-1 text-sm capitalize transition-colors",
              risk === r
                ? "border-series-1 bg-series-1/10 text-series-1"
                : "text-text-secondary hover:bg-surface-2",
            )}
          >
            {r} <span className="tabular text-text-muted">({counts[r] ?? 0})</span>
          </button>
        ))}
        <span className="ml-auto text-xs text-text-muted">
          {num(data.total_flagged)} sessions network-wide score above the threshold (
          {data.threshold.toFixed(2)}); showing the top {num(data.sessions.length)}
        </span>
      </div>

      <Card>
        <CardContent className="pt-5">
          <Table className="tabular">
            <THead>
              <TR>
                <TH>Station</TH>
                <TH>City</TH>
                <TH>Vehicle</TH>
                <TH>Energy</TH>
                <TH>SOC Δ</TH>
                <TH>
                  <button
                    className="flex items-center gap-1 font-medium hover:text-text-primary"
                    onClick={() => setSortDesc((v) => !v)}
                  >
                    Score {sortDesc ? "↓" : "↑"}
                  </button>
                </TH>
                <TH>Risk</TH>
              </TR>
            </THead>
            <tbody>
              {rows.map((s) => (
                <TR
                  key={s.index}
                  className="cursor-pointer hover:bg-surface-2"
                  onClick={() => setSelected(s)}
                >
                  <TD className="font-medium text-text-primary">{s.station_id}</TD>
                  <TD>{s.location}</TD>
                  <TD>{s.vehicle_model}</TD>
                  <TD>{s.energy_kwh === null ? "—" : `${num(s.energy_kwh, 1)} kWh`}</TD>
                  <TD>{s.soc_delta_pct === null ? "—" : `${num(s.soc_delta_pct, 1)}`}</TD>
                  <TD>{s.anomaly_score.toFixed(3)}</TD>
                  <TD>
                    <Badge tone={RISK_TONE[s.risk]}>{s.risk}</Badge>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
          {rows.length === 0 && (
            <p className="py-8 text-center text-sm text-text-muted">No sessions match this filter.</p>
          )}
        </CardContent>
      </Card>

      <ReasonDrawer session={selected} onClose={() => setSelected(null)} />
    </>
  );
}

function ReasonDrawer({
  session,
  onClose,
}: {
  session: AnomalySession | null;
  onClose: () => void;
}) {
  if (!session) return null;
  const reasons = session.reasons.split(";").map((r) => r.trim()).filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <button
        aria-label="Close"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="relative flex w-full max-w-md flex-col gap-4 overflow-y-auto border-l bg-surface p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-text-muted">Session #{session.index}</p>
            <h2 className="text-lg font-semibold text-text-primary">{session.station_id}</h2>
            <p className="text-sm text-text-secondary">
              {session.vehicle_model} · {session.location}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-text-muted hover:bg-surface-2 hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 text-sm">
          <Metric label="Score" value={session.anomaly_score.toFixed(3)} />
          <Metric
            label="Energy"
            value={session.energy_kwh === null ? "—" : `${num(session.energy_kwh, 1)} kWh`}
          />
          <Metric
            label="Capacity"
            value={
              session.battery_capacity_kwh === null
                ? "—"
                : `${num(session.battery_capacity_kwh, 1)} kWh`
            }
          />
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-text-primary">Why it was flagged</p>
          {reasons.length ? (
            <ul className="space-y-2 text-sm text-text-secondary">
              {reasons.map((r, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-serious" />
                  {r}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-muted">No rule violations recorded.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-text-muted">{label}</p>
      <p className="tabular font-medium text-text-primary">{value}</p>
    </div>
  );
}
