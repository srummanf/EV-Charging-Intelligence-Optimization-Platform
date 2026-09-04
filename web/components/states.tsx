import { AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function ApiErrorCard({ message }: { message: string }) {
  return (
    <Card className="border-critical/30 bg-critical/5">
      <CardContent className="flex items-start gap-3 pt-5">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-critical" />
        <div className="space-y-1 text-sm">
          <p className="font-medium text-text-primary">Couldn&apos;t load this data</p>
          <p className="text-text-secondary">{message}</p>
          <p className="text-text-muted">
            Start the API with{" "}
            <code className="rounded bg-surface-2 px-1 py-0.5">uvicorn api.app:app</code> and
            reload.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed p-10 text-center text-sm text-text-muted">
      {message}
    </div>
  );
}
