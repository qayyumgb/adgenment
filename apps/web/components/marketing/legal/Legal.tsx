import Link from "next/link";
import type { ReactNode } from "react";
import { Accent, Eyebrow } from "@/components/marketing/ui/Heading";
import { LegalToc } from "./LegalToc";

/**
 * Shared chrome for the Privacy and Terms pages (redesign: restyle only —
 * the legal text itself lives unchanged in each page). Body copy is styled
 * by `.mk-legal` in app/(marketing)/marketing.css.
 */

const PAGES = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/data-deletion", label: "Data deletion" },
];

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/^\d+\.\s*/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export function LegalLayout({
  title,
  accent,
  effectiveDate,
  current,
  children,
}: {
  title: string;
  accent: string;
  effectiveDate: string;
  current: "/privacy" | "/terms";
  children: ReactNode;
}) {
  return (
    <>
      <section className="border-b-2 border-mk-rule px-[clamp(16px,4vw,32px)] pb-0 pt-[clamp(48px,8vw,104px)]">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-[18px]">
          <Eyebrow>LEGAL · EFFECTIVE {effectiveDate.toUpperCase()}</Eyebrow>
          <h1 className="m-0 text-[clamp(44px,8vw,96px)] font-medium leading-[.95] tracking-[-0.055em]">
            {title} <Accent>{accent}</Accent>
          </h1>
          <nav aria-label="Legal pages" className="mt-[clamp(12px,3vw,28px)] flex gap-6 overflow-x-auto">
            {PAGES.map((p) => {
              const on = p.href === current;
              return (
                <Link
                  key={p.href}
                  href={p.href}
                  aria-current={on ? "page" : undefined}
                  className={`-mb-0.5 whitespace-nowrap border-b-2 pb-3.5 text-[15px] font-semibold transition-colors ${
                    on ? "border-mk-ink text-mk-ink" : "border-transparent text-mk-ink2 hover:text-mk-ink"
                  }`}
                >
                  {p.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </section>
      <section className="px-[clamp(16px,4vw,32px)] py-[clamp(48px,7vw,88px)]">
        <div className="mx-auto flex max-w-[1280px] items-start gap-[clamp(28px,5vw,72px)]">
          <LegalToc />
          <article className="mk-legal min-w-0 max-w-[760px] flex-1">{children}</article>
        </div>
      </section>
    </>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section id={slug(title)} data-legal-section={title} className="scroll-mt-24 border-t border-mk-hair py-8 first:border-t-0 first:pt-0">
      <h2>{title}</h2>
      <div className="mk-legal-body">{children}</div>
    </section>
  );
}
