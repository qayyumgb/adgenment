"use client";

import { useEffect, useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

/**
 * Marketing-only motion: Lenis smooth scroll + the shared scroll reveals
 * (`data-reveal="line | up | rise | grow"`), ported from the mockups'
 * site-motion.js.
 *
 * Mounted once by the marketing layout. Unmounting (navigating into the
 * dashboard) destroys Lenis and every trigger, so none of this leaks.
 * Page-specific scenes (pins, demos) use their own `useGSAP` hooks.
 */

gsap.registerPlugin(ScrollTrigger);

const MOTION_CLASS = "mk-motion";

// useLayoutEffect warns during SSR; this component only matters on the client.
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Inline script for the layout: sets the reveal gate before first paint. */
export const MOTION_GATE_SCRIPT = `try{if(!matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.classList.add('${MOTION_CLASS}')}catch(e){}`;

export function MarketingMotion() {
  const pathname = usePathname();

  // Lenis lives for the whole marketing session (across page navigations).
  useIsoLayoutEffect(() => {
    if (prefersReducedMotion()) return;
    // Client-side navigation into marketing doesn't run the inline gate
    // script, so set the class here too (before paint).
    document.documentElement.classList.add(MOTION_CLASS);

    const lenis = new Lenis({
      duration: 1.15,
      easing: (t: number) => 1 - Math.pow(1 - t, 4),
      anchors: { offset: -72 },
      autoRaf: false,
    });
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    let resizeTimer: ReturnType<typeof setTimeout> | undefined;
    const ro = new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => ScrollTrigger.refresh(), 250);
    });
    ro.observe(document.body);
    document.fonts?.ready.then(() => ScrollTrigger.refresh());

    return () => {
      clearTimeout(resizeTimer);
      ro.disconnect();
      gsap.ticker.remove(tick);
      lenis.destroy();
      document.documentElement.classList.remove(MOTION_CLASS);
    };
  }, []);

  // Reveals are (re)wired for each page's fresh DOM.
  useIsoLayoutEffect(() => {
    const root = document.querySelector<HTMLElement>(".mk");
    if (!root) return;
    const pending = Array.from(
      root.querySelectorAll<HTMLElement>("[data-reveal]:not([data-reveal-done])")
    );
    if (pending.length === 0) return;

    if (prefersReducedMotion()) {
      pending.forEach((el) => el.setAttribute("data-reveal-done", ""));
      return;
    }

    const ctx = gsap.context(() => {
      const byKind = (kind: string) =>
        pending.filter((el) => el.dataset.reveal === kind);

      byKind("line").forEach((el, i) => {
        // y: 0 explicitly — otherwise GSAP absorbs the CSS gate's
        // translateY(108%) as a pixel offset and the line ends up shifted.
        gsap.fromTo(
          el,
          { yPercent: 108, y: 0 },
          { yPercent: 0, y: 0, duration: 1.3, ease: "expo.out", delay: 0.05 + i * 0.08 }
        );
      });

      byKind("up").forEach((el) => {
        gsap.fromTo(
          el,
          { y: 40, autoAlpha: 0 },
          {
            y: 0,
            autoAlpha: 1,
            duration: 1.1,
            ease: "expo.out",
            scrollTrigger: { trigger: el, start: "top 90%", once: true },
          }
        );
      });

      byKind("grow").forEach((el) => {
        gsap.fromTo(
          el,
          { scaleX: 0, transformOrigin: "left center" },
          {
            scaleX: 1,
            duration: 1.6,
            ease: "power3.inOut",
            scrollTrigger: { trigger: el, start: "top 94%", once: true },
          }
        );
      });

      const rise = byKind("rise");
      if (rise.length) {
        gsap.set(rise, { y: 36, autoAlpha: 0 });
        ScrollTrigger.batch(rise, {
          start: "top 92%",
          once: true,
          onEnter: (batch) =>
            gsap.to(batch, {
              y: 0,
              autoAlpha: 1,
              duration: 0.9,
              ease: "expo.out",
              stagger: 0.07,
            }),
        });
      }
    }, root);

    // Mark as handled so the CSS fallback (marketing.css) stays out of the way.
    pending.forEach((el) => el.setAttribute("data-reveal-done", ""));
    ScrollTrigger.refresh();

    // Revert and unmark so a re-run (route change, or React Strict Mode's
    // mount → unmount → mount in dev) animates them again instead of leaving
    // them frozen in their hidden "from" state.
    return () => {
      ctx.revert();
      pending.forEach((el) => el.removeAttribute("data-reveal-done"));
    };
  }, [pathname]);

  return null;
}
