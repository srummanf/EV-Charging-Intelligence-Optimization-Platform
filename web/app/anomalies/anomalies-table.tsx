"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { AnomalyList, AnomalySession, Risk } from "@/lib/types";
import { cn, num } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MetricPanel, MetricStats } from "@/components/ui/metric-panel";
import { Sparkline } from "@/components/charts";

const RISK_TONE: Record<Risk, "high" | "medium" | "normal"> = {
  high: "high",
  medium: "medium",
  normal: "normal",
};
const RISK_ACCENT: Record<Risk, string> = {
  high: "border-l-danger bg-danger/[0.07]",
  medium: "border-l-warning/60",
  normal: "border-l-transparent",
};
const SCORE_COLOR: Record<Risk, string> = {
  high: "text-danger",
  medium: "text-warning",
  normal: "text-foreground",
};
const FILTERS: ("all" | Risk)[] = ["all", "high", "medium", "normal"];

export function AnomaliesTable({ data }: { data: AnomalyList }) {
  const [risk, setRisk] = useState<"all" | Risk>("all");
  const [sortDesc, setSortDesc] = useState(true);
  const [selected, setSelected] = useState<AnomalySession | null>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = {
      all: data.sessions.length,
      high: 0,
      medium: 0,
      normal: 0,
    };
    for (const s of data.sessions) c[s.risk]++;
    return c;
  }, [data.sessions]);

  const rows = useMemo(() => {
    const f = data.sessions.filter((s) => risk === "all" || s.risk === risk);
    return [...f].sort((a, b) =>
      sortDesc
        ? b.anomaly_score - a.anomaly_score
        : a.anomaly_score - b.anomaly_score,
    );
  }, [data.sessions, risk, sortDesc]);

  const sortedScores = [...data.sessions.map((s) => s.anomaly_score)].sort(
    (a, b) => b - a,
  );
  const spark = sortedScores.map((v, i) => ({ i, v }));
  const medianScore = sortedScores.length
    ? sortedScores[Math.floor(sortedScores.length / 2)]
    : 0;

  return (
    <>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <MetricPanel
          label="Flagged"
          sublabel={`score at or above ${data.threshold.toFixed(2)}`}
          accent="rose"
          size="sm"
          value={num(data.total_flagged)}
          bleed={
            <Sparkline
              data={spark}
              dataKey="v"
              height="100%"
              color="var(--danger)"
            />
          }
          bleedWidth={64}
          footerPrimary={`${counts.high} high risk`}
          footerSecondary={
            <MetricStats
              items={[
                [String(counts.medium), "medium"],
                [String(counts.normal), "normal"],
              ]}
            />
          }
        />
        <MetricPanel
          label="Median score"
          sublabel="across shown sessions"
          accent="neutral"
          size="sm"
          value={medianScore.toFixed(3)}
          footerPrimary={`${sortedScores.at(-1)?.toFixed(3) ?? "-"} to ${sortedScores[0]?.toFixed(3) ?? "-"}`}
        />
        <MetricPanel
          label="Showing"
          sublabel="top rows by score"
          accent="blue"
          size="sm"
          value={num(data.sessions.length)}
          unit="rows"
          footerPrimary="Isolation Forest, complements the hard rules"
        />
      </div>

      <div className="mb-4">
        <ToggleGroup
          type="single"
          value={risk}
          onValueChange={(v) => v && setRisk(v as "all" | Risk)}
          className="h-auto flex-wrap"
        >
          {FILTERS.map((r) => (
            <ToggleGroupItem key={r} value={r} className="capitalize">
              {r !== "all" && r !== "normal" ? (
                <span
                  className={cn(
                    "mr-1.5 size-1.5 rounded-full",
                    r === "high" ? "bg-danger" : "bg-warning",
                  )}
                  aria-hidden
                />
              ) : null}
              {r}
              <span className="nums ml-1.5 text-muted-foreground/60">
                {counts[r] ?? 0}
              </span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH className="pl-4">Station</TH>
                <TH>City</TH>
                <TH>Vehicle</TH>
                <TH className="text-right">Energy</TH>
                <TH className="text-right">SOC Δ</TH>
                <TH className="text-right">
                  <button
                    className="ml-auto flex items-center gap-1 hover:text-foreground"
                    onClick={() => setSortDesc((v) => !v)}
                  >
                    Score
                    {sortDesc ? (
                      <ArrowDown className="size-3" />
                    ) : (
                      <ArrowUp className="size-3" />
                    )}
                  </button>
                </TH>
                <TH>Risk</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((s) => (
                <TR
                  key={s.index}
                  onClick={() => setSelected(s)}
                  className={cn(
                    "cursor-pointer border-l-2",
                    RISK_ACCENT[s.risk],
                  )}
                >
                  <TD className="pl-4 font-medium text-foreground">{s.station_id}</TD>
                  <TD className="text-muted-foreground">{s.location}</TD>
                  <TD className="text-muted-foreground">{s.vehicle_model}</TD>
                  <TD num>
                    {s.energy_kwh === null ? "-" : `${num(s.energy_kwh, 1)}`}
                  </TD>
                  <TD num>
                    {s.soc_delta_pct === null ? "-" : num(s.soc_delta_pct, 1)}
                  </TD>
                  <TD num className={cn("font-semibold", SCORE_COLOR[s.risk])}>
                    {s.anomaly_score.toFixed(3)}
                  </TD>
                  <TD>
                    <Badge tone={RISK_TONE[s.risk]} dot={s.risk !== "normal"}>
                      {s.risk}
                    </Badge>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          {rows.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No sessions match this filter.
            </p>
          )}
        </CardContent>
      </Card>

      <Sheet
        open={selected !== null}
        onOpenChange={(o) => !o && setSelected(null)}
      >
        {selected && (
          <SheetContent>
            <SheetHeader>
              <p className="nums text-xs uppercase tracking-wider text-muted-foreground">
                Session #{selected.index}
              </p>
              <SheetTitle>{selected.station_id}</SheetTitle>
              <SheetDescription>
                {selected.vehicle_model} · {selected.location}
              </SheetDescription>
            </SheetHeader>

            <div className="grid grid-cols-3 gap-3">
              <Metric label="Score" value={selected.anomaly_score.toFixed(3)} />
              <Metric
                label="Energy"
                value={
                  selected.energy_kwh === null
                    ? "-"
                    : `${num(selected.energy_kwh, 1)} kWh`
                }
              />
              <Metric
                label="Capacity"
                value={
                  selected.battery_capacity_kwh === null
                    ? "-"
                    : `${num(selected.battery_capacity_kwh, 1)} kWh`
                }
              />
            </div>

            <Separator />

            <div>
              <p className="mb-2.5 text-sm font-medium">Why it was flagged</p>
              <Reasons text={selected.reasons} />
            </div>
          </SheetContent>
        )}
      </Sheet>
    </>
  );
}

function Reasons({ text }: { text: string }) {
  const reasons = text
    .split(";")
    .map((r) => r.trim())
    .filter(Boolean);
  if (!reasons.length)
    return (
      <p className="text-sm text-muted-foreground">No rule violations recorded.</p>
    );
  return (
    <ol className="space-y-2.5 text-sm text-muted-foreground">
      {reasons.map((r, i) => (
        <li key={i} className="flex gap-3">
          <span className="nums shrink-0 text-xs font-medium text-muted-foreground/60">
            {String(i + 1).padStart(2, "0")}
          </span>
          <span className="[&::first-letter]:uppercase">{r}</span>
        </li>
      ))}
    </ol>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-display text-lg font-medium tabular-nums tracking-tight">
        {value}
      </p>
    </div>
  );
}
