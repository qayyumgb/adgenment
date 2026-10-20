"use client";

import { useId, useState } from "react";

export type Faq = { q: string; a: string };

/** Single-open accordion (Home + Pricing). Collapsed answers are inert. */
export function FaqAccordion({
  items,
  defaultOpen = -1,
  variant = "default",
  className = "",
}: {
  items: Faq[];
  defaultOpen?: number;
  /** "large": Home's bigger questions and ink-ringed toggle. */
  variant?: "default" | "large";
  className?: string;
}) {
  const large = variant === "large";
  const [open, setOpen] = useState(defaultOpen);
  const base = useId();

  return (
    <div className={`border-t-2 border-mk-rule ${className}`}>
      {items.map((f, i) => {
        const isOpen = open === i;
        const btnId = `${base}-q${i}`;
        const panelId = `${base}-a${i}`;
        return (
          <div key={f.q} className="border-b border-mk-hair">
            <h3 className="m-0">
              <button
                id={btnId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? -1 : i)}
                className={`flex w-full items-center gap-4 py-5 text-left font-medium text-mk-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-brand ${
                  large ? "text-[clamp(17px,1.8vw,19px)] tracking-[-0.01em]" : "text-lg tracking-[-0.015em]"
                }`}
              >
                <span className="flex-1">{f.q}</span>
                <span
                  aria-hidden="true"
                  className={`flex flex-none items-center justify-center rounded-full transition-transform ease-[cubic-bezier(.2,.7,.2,1)] ${
                    large
                      ? "h-8 w-8 border-[1.5px] border-mk-ink text-lg duration-[400ms]"
                      : "h-[30px] w-[30px] border border-mk-line2 duration-[350ms]"
                  } ${isOpen ? "rotate-45" : ""}`}
                >
                  +
                </span>
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={btnId}
              // React 18 ignores boolean `inert`; an empty string sets the
              // attribute. The types say boolean, hence the cast.
              {...(isOpen ? {} : ({ inert: "" } as unknown as { inert: boolean }))}
              className={`grid transition-[grid-template-rows] duration-[450ms] ease-[cubic-bezier(.2,.7,.2,1)] ${
                isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              }`}
            >
              <div className="overflow-hidden">
                <p className={`m-0 text-mk-ink2 [text-wrap:pretty] ${large ? "mb-[22px] max-w-[640px]" : "mb-5"}`}>
                  {f.a}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
