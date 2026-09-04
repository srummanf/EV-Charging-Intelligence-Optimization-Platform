"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, AlertTriangle, BarChart3, Gauge, LineChart, Layers, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

const OPERATOR_NAV = [
  { href: "/overview", label: "Overview", icon: Gauge },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/segments", label: "Segments", icon: Layers },
  { href: "/anomalies", label: "Anomalies", icon: AlertTriangle },
  { href: "/forecast", label: "Forecast", icon: LineChart },
];
const DRIVER_NAV = [{ href: "/my-charging", label: "My Charging", icon: Zap }];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 border-b bg-page/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          <Link href="/overview" className="flex items-center gap-2 font-semibold">
            <Activity className="h-5 w-5 text-series-1" />
            <span className="hidden sm:inline">EV Charging Platform</span>
          </Link>
          <nav className="flex flex-1 flex-wrap items-center gap-1">
            {OPERATOR_NAV.map((item) => (
              <NavLink key={item.href} {...item} active={pathname === item.href} />
            ))}
            <span className="mx-1 hidden h-4 w-px bg-border sm:inline-block" />
            {DRIVER_NAV.map((item) => (
              <NavLink key={item.href} {...item} active={pathname === item.href} />
            ))}
          </nav>
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      <footer className="border-t">
        <div className="mx-auto max-w-6xl px-4 py-4 text-xs text-text-muted">
          EV Charging Intelligence &amp; Optimization Platform — operator &amp; driver views over
          the FastAPI service. Metrics reflect a synthetic dataset (see project README).
        </div>
      </footer>
    </div>
  );
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-surface-2 text-text-primary"
          : "text-text-secondary hover:text-text-primary",
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="hidden md:inline">{label}</span>
    </Link>
  );
}
