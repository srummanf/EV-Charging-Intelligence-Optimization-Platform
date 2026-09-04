import * as React from "react";
import { cn } from "@/lib/utils";

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      className={cn(
        "text-xs font-medium text-muted-foreground select-none",
        className,
      )}
      {...props}
    />
  );
}

const control =
  "h-9 w-full rounded-md border bg-card px-3 text-sm text-foreground shadow-sm outline-none transition-[border,box-shadow] " +
  "placeholder:text-muted-foreground/60 " +
  "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input className={cn(control, "nums tabular-nums", className)} {...props} />
  );
}

export function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        className={cn(control, "cursor-pointer appearance-none pr-8", className)}
        {...props}
      >
        {children}
      </select>
      <svg
        className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}

export function Fieldset({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={htmlFor}>{label}</Label>
        {hint ? (
          <span className="text-[0.6875rem] font-normal text-muted-foreground/60">
            {hint}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}
