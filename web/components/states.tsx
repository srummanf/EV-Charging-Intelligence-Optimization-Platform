import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function ApiErrorCard({ message }: { message: string }) {
  return (
    <Card className="border-danger/30 bg-danger/[0.04]">
      <CardContent className="flex items-start gap-3">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-danger/10 text-danger">
          <AlertTriangle className="size-4" />
        </span>
        <div className="space-y-1 text-sm">
          <p className="font-medium text-foreground">Couldn&apos;t load this data</p>
          <p className="text-muted-foreground">{message}</p>
          <p className="text-muted-foreground/80">
            Start the API with{" "}
            <code className="nums rounded bg-muted px-1.5 py-0.5 text-xs">
              uvicorn api.app:app
            </code>{" "}
            and reload.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function EmptyState({
  title,
  message,
  icon,
}: {
  title?: string;
  message: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-64 place-items-center rounded-xl border border-dashed bg-card/40 p-10 text-center">
      <div className="space-y-1.5">
        {icon ? (
          <div className="mx-auto grid size-10 place-items-center rounded-lg bg-muted text-muted-foreground">
            {icon}
          </div>
        ) : null}
        {title ? <p className="text-sm font-medium">{title}</p> : null}
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
