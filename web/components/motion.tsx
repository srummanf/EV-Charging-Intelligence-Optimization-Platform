"use client";

import * as React from "react";

/**
 * Motion helpers for the console, kept deliberately small.
 *
 * `CountUp` animates a KPI from 0 to its value once on mount and degrades to
 * the plain final value under `prefers-reduced-motion: reduce` or with no JS.
 *
 * `Reveal` is a layout-neutral wrapper (`data-reveal` marker) kept as the
 * single attach point for a future scroll-entrance treatment. It renders its
 * children as-is and never affects visibility, so content is always readable.
 */

export function Reveal({
  children,
  className,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  /** Accepted for call-site intent (stagger ordering); not yet wired. */
  delay?: number;
  as?: React.ElementType;
}) {
  const Component = Tag as React.ElementType;
  return (
    <Component data-reveal="" className={className}>
      {children}
    </Component>
  );
}

export function CountUp({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  duration = 900,
  className,
}: {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const [display, setDisplay] = React.useState(value);

  React.useEffect(() => {
    if (
      typeof window === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(value * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return (
    <span className={className}>
      {prefix}
      {display.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}
