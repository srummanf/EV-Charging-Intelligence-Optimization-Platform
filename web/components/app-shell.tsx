"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  Gauge,
  LineChart,
  Layers,
  Plug,
  Zap,
} from "lucide-react";
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
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1280px] items-center gap-2 px-4 sm:px-6">
          <Link
            href="/overview"
            className="flex items-center gap-2 rounded-md pr-2 text-sm font-semibold tracking-tight"
          >
            <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
              <Plug className="size-4" />
            </span>
            <span className="hidden sm:inline">EV&nbsp;Charging</span>
          </Link>

          <div className="mx-1 hidden h-5 w-px bg-border sm:block" />

          <nav className="flex flex-1 items-center gap-0.5 overflow-x-auto">
            {OPERATOR_NAV.map((item) => (
              <NavLink key={item.href} {...item} active={pathname === item.href} />
            ))}
            <span className="mx-1.5 h-4 w-px shrink-0 bg-border" />
            {DRIVER_NAV.map((item) => (
              <NavLink key={item.href} {...item} active={pathname === item.href} />
            ))}
          </nav>

          <ThemeToggle />
        </div>
      </header>

      <main className="page-grid mx-auto w-full max-w-[1280px] flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>

      <footer className="border-t">
        <div className="mx-auto max-w-[1280px] px-4 py-4 text-xs text-muted-foreground sm:px-6">
          EV Charging Intelligence &amp; Optimization Platform. Operator and driver views
          over the FastAPI service; metrics reflect a synthetic dataset (see the README).
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
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[0.8125rem] font-medium transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="size-4" />
      <span className="hidden md:inline">{label}</span>
    </Link>
  );
}
