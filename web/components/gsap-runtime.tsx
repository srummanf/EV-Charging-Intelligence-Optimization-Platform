"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * One place that owns page motion.
 *
 * - `[data-reveal]` elements (rendered by `Reveal`) fade and rise in as they
 *   enter the viewport, batched so an above-the-fold cluster staggers together.
 * - `[data-parallax]` elements drift on scroll.
 *
 * Everything is gated behind `prefers-reduced-motion: no-preference`, so with
 * reduced motion the elements are simply never hidden. A `gsap.delayedCall`
 * safety net forces visibility for anything still hidden after 2s in case a
 * ScrollTrigger never activates.
 */
export function GsapRuntime({ children }: { children: React.ReactNode }) {
  const scope = React.useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useGSAP(
    () => {
      const reveals = gsap.utils.toArray<HTMLElement>("[data-reveal]");
      (window as unknown as Record<string, unknown>).__gsap = {
        ran: true,
        reveals: reveals.length,
        st: ScrollTrigger,
      };
      console.log("[gsap] runtime ran, reveals =", reveals.length);

      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        if (reveals.length) {
          gsap.set(reveals, { opacity: 0, y: 18 });
          ScrollTrigger.batch(reveals, {
            start: "top 90%",
            once: true,
            interval: 0.08,
            batchMax: 8,
            onEnter: (batch) =>
              gsap.to(batch, {
                opacity: 1,
                y: 0,
                duration: 0.7,
                stagger: 0.08,
                ease: "power2.out",
                overwrite: true,
              }),
          });
        }

        gsap.utils.toArray<HTMLElement>("[data-parallax]").forEach((el) => {
          gsap.to(el, {
            yPercent: 22,
            ease: "none",
            scrollTrigger: {
              trigger: el,
              start: "top bottom",
              end: "bottom top",
              scrub: 1,
            },
          });
        });

        ScrollTrigger.refresh();
      });

      // Fonts change layout; recompute trigger positions once they load.
      if (typeof document !== "undefined" && "fonts" in document) {
        document.fonts.ready.then(() => ScrollTrigger.refresh());
      }

      // Safety net: never leave content stuck hidden.
      gsap.delayedCall(2, () => {
        for (const el of reveals) {
          if (parseFloat(getComputedStyle(el).opacity || "1") < 0.05) {
            gsap.to(el, { opacity: 1, y: 0, duration: 0.4, overwrite: true });
          }
        }
      });
    },
    { scope, dependencies: [pathname], revertOnUpdate: true },
  );

  return (
    <div ref={scope} className="contents">
      {children}
    </div>
  );
}
