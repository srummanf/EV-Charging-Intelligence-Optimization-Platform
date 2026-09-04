import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badge = cva(
  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
  {
    variants: {
      tone: {
        neutral: "bg-surface-2 text-text-secondary ring-border",
        high: "bg-critical/10 text-critical ring-critical/30",
        medium: "bg-serious/10 text-serious ring-serious/30",
        normal: "bg-good/10 text-good ring-good/30",
        info: "bg-series-1/10 text-series-1 ring-series-1/30",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badge>) {
  return <span className={cn(badge({ tone }), className)} {...props} />;
}
