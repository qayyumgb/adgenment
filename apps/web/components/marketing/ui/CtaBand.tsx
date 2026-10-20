import type { ReactNode } from "react";
import { AccentHeading } from "./Heading";

/** Dark rounded card with the bottom glow — the shell of every closing CTA. */
export function CtaShell({ children }: { children: ReactNode }) {
  return (
    <section className="px-[clamp(12px,3vw,24px)] pb-[clamp(12px,3vw,24px)]">
      <div
        data-reveal="up"
        className="relative mx-auto max-w-[1280px] overflow-hidden rounded-[clamp(24px,4vw,40px)] bg-mk-ink px-[clamp(20px,5vw,64px)] py-[clamp(40px,7vw,88px)] text-mk-on-dark"
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -left-[10%] -right-[10%] bottom-[-70%] h-[130%] bg-[radial-gradient(closest-side,rgba(124,100,255,.5),transparent)]"
        />
        <div className="relative">{children}</div>
      </div>
    </section>
  );
}

/**
 * Standard closing call-to-action: serif-accent heading left, buttons right.
 * Pass the buttons as children (usually a `white` + `ghost-dark` PillButton).
 */
export function CtaBand({
  lead,
  accent,
  children,
}: {
  lead: ReactNode;
  accent: ReactNode;
  children: ReactNode;
}) {
  return (
    <CtaShell>
      <div className="flex flex-wrap items-end justify-between gap-x-12 gap-y-6">
        <AccentHeading lead={lead} accent={accent} onDark reveal={false} className="flex-[1_1_520px]" />
        <div className="flex flex-wrap gap-2.5">{children}</div>
      </div>
    </CtaShell>
  );
}
