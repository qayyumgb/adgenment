"use client";

import { useEffect, useState } from "react";

/** "On this page" list built from the page's LegalSection headings (desktop). */
export function LegalToc() {
  const [items, setItems] = useState<{ id: string; title: string }[]>([]);
  const [cur, setCur] = useState("");

  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-legal-section]"));
    setItems(els.map((el) => ({ id: el.id, title: el.dataset.legalSection ?? "" })));
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setCur(e.target.id)),
      { rootMargin: "-20% 0px -70% 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  if (items.length === 0) return <div className="hidden flex-[0_0_260px] mk-lg:block" />;

  return (
    <nav
      aria-label="On this page"
      className="sticky top-24 hidden max-h-[calc(100vh-120px)] flex-[0_0_260px] flex-col overflow-y-auto border-t-2 border-mk-rule mk-lg:flex"
      data-lenis-prevent
    >
      <span className="pb-2 pt-3.5 font-mk-mono text-xs tracking-[.06em] text-mk-ink3">ON THIS PAGE</span>
      {items.map((it) => {
        const on = it.id === cur;
        return (
          <a
            key={it.id}
            href={`#${it.id}`}
            aria-current={on ? "location" : undefined}
            className={`border-b border-mk-hair py-2 text-[14px] leading-snug transition-colors ${
              on ? "font-semibold text-mk-ink" : "text-mk-ink2 hover:text-mk-ink"
            }`}
          >
            {it.title}
          </a>
        );
      })}
    </nav>
  );
}
