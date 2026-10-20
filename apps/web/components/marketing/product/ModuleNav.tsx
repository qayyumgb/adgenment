"use client";

import { useEffect, useState } from "react";
import { MODULES } from "./modules";

/** Sticky module index with scroll-spy (desktop only). */
export function ModuleNav() {
  const [cur, setCur] = useState(0);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) setCur(Number((e.target as HTMLElement).dataset.ch));
        }),
      { rootMargin: "-45% 0px -45% 0px" }
    );
    document.querySelectorAll("[data-ch]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <nav
      aria-label="Modules"
      className="sticky top-24 hidden flex-[0_0_240px] flex-col border-t-2 border-mk-rule mk-lg:flex"
    >
      <span className="pb-2 pt-3.5 font-mk-mono text-xs tracking-[.06em] text-mk-ink3">MODULES</span>
      {MODULES.map((m, i) => {
        const on = i === cur;
        return (
          <a
            key={m.id}
            href={`#${m.id}`}
            aria-current={on ? "location" : undefined}
            className={`flex items-center gap-3 border-b border-mk-hair py-2.5 text-[15px] transition-colors duration-300 ${
              on ? "font-semibold text-mk-ink" : "font-medium text-mk-ink2 hover:text-mk-ink"
            }`}
          >
            <span className={`font-mk-mono text-xs ${on ? "text-mk-brand" : "text-mk-ink3"}`}>
              {String(i + 1).padStart(2, "0")}
            </span>
            {m.name}
            <span className="flex-1" />
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${on ? "bg-mk-brand" : "bg-transparent"}`}
            />
          </a>
        );
      })}
    </nav>
  );
}
