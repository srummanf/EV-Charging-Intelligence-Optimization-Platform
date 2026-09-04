import * as React from "react";
import { cn } from "@/lib/utils";

export function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div className="w-full overflow-x-auto">
      <table
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  );
}

export function THead({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      className={cn(
        "[&_th]:h-9 [&_th]:px-3 [&_th]:text-left [&_th]:align-middle",
        "[&_th]:text-[0.6875rem] [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-wider",
        "[&_th]:text-muted-foreground [&_tr]:border-b",
        className,
      )}
      {...props}
    />
  );
}

export function TBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      className={cn(
        "[&_tr]:border-b [&_tr:last-child]:border-0",
        "[&_td]:px-3 [&_td]:py-2.5 [&_td]:align-middle",
        className,
      )}
      {...props}
    />
  );
}

export function TR({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      className={cn("transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted", className)}
      {...props}
    />
  );
}

export function TH({ className, ...props }: React.ComponentProps<"th">) {
  return <th className={className} {...props} />;
}

export function TD({
  className,
  num,
  ...props
}: React.ComponentProps<"td"> & { num?: boolean }) {
  return (
    <td
      className={cn(num && "nums text-right tabular-nums", className)}
      {...props}
    />
  );
}
