import type { Metadata } from "next";
import {
  Bricolage_Grotesque,
  Hanken_Grotesk,
  JetBrains_Mono,
} from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GsapRuntime } from "@/components/gsap-runtime";
import { AppShell } from "@/components/app-shell";

// Working sans: humanist grotesk, tight and legible at data-table sizes.
const fontSans = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--ff-sans",
  display: "swap",
});

// Display: characterful contrast grotesk for headings and big metric numerals.
const fontDisplay = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--ff-display",
  display: "swap",
});

// Mono: tabular figures for `.nums` (tables, axes, stat values).
const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--ff-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "EV Charging Platform",
  description:
    "Operator and driver console for the EV Charging Intelligence & Optimization Platform.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`h-full ${fontSans.variable} ${fontDisplay.variable} ${fontMono.variable}`}
    >
      <body className="min-h-full antialiased">
        <ThemeProvider>
          <TooltipProvider>
            <AppShell>
              <GsapRuntime>{children}</GsapRuntime>
            </AppShell>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
