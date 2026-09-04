import { Card, CardContent } from "@/components/ui/card";

export function KpiCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 pt-5">
        <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
          {label}
        </span>
        <span className="tabular text-2xl font-semibold text-text-primary">{value}</span>
        {sub ? <span className="text-xs text-text-secondary">{sub}</span> : null}
      </CardContent>
    </Card>
  );
}
