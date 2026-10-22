"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Thin bar under the top edge that starts the moment a link or a navigating
 * button is pressed and finishes when the new route renders. Without it a
 * click on a slow route (cold server, first compile in dev) looks ignored.
 *
 * Links are picked up automatically (document click listener). Code that
 * navigates with the router uses `useAppRouter` (hooks/useAppRouter.ts),
 * which calls `startNavigation`.
 */

const START_EVENT = "advertix:navstart";

/** Show the bar for a navigation to `href` (ignored when it's the current URL). */
export function startNavigation(href: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(START_EVENT, { detail: href }));
}

function isNewUrl(href: string) {
  try {
    const next = new URL(href, window.location.href);
    if (next.origin !== window.location.origin) return false;
    return next.pathname !== window.location.pathname || next.search !== window.location.search;
  } catch {
    return false;
  }
}

export function NavigationProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  // idle → running (creeps toward 90%) → done (fills, then fades out).
  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle");
  const running = useRef(false);

  useEffect(() => {
    const start = (href: string) => {
      if (!isNewUrl(href)) return;
      running.current = true;
      setPhase("running");
    };
    const onEvent = (e: Event) => start((e as CustomEvent<string>).detail);
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || !a.href || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      start(a.href);
    };
    window.addEventListener(START_EVENT, onEvent);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener(START_EVENT, onEvent);
      document.removeEventListener("click", onClick);
    };
  }, []);

  // The route changed: finish the bar.
  useEffect(() => {
    if (!running.current) return;
    running.current = false;
    setPhase("done");
  }, [pathname, search]);

  useEffect(() => {
    if (phase === "done") {
      const t = setTimeout(() => setPhase("idle"), 350);
      return () => clearTimeout(t);
    }
    if (phase === "running") {
      // Never stuck: a navigation that's cancelled or fails just clears.
      const t = setTimeout(() => {
        running.current = false;
        setPhase("idle");
      }, 20_000);
      return () => clearTimeout(t);
    }
  }, [phase]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5">
      <div
        className="h-full origin-left bg-brand"
        style={{
          transform: `scaleX(${phase === "idle" ? 0 : phase === "running" ? 0.9 : 1})`,
          opacity: phase === "idle" ? 0 : 1,
          // Fast start, then a long creep while waiting; quick fill on finish.
          transition:
            phase === "running"
              ? "transform 8s cubic-bezier(0.1, 0.7, 0.2, 1), opacity 0s"
              : phase === "done"
                ? "transform 150ms ease-out, opacity 200ms ease 150ms"
                : "none",
        }}
      />
    </div>
  );
}
