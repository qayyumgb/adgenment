import type { ReactNode } from "react";

type Tone = "paper" | "band" | "dark";

const TONES: Record<Tone, string> = {
  paper: "",
  band: "bg-mk-s2",
  dark: "bg-mk-band text-mk-on-dark",
};

/**
 * Standard marketing section: gutter, vertical rhythm and the 1280px
 * container. `rule` draws the 2px top rule used between sections.
 */
export function Section({
  id,
  tone = "paper",
  rule = false,
  className = "",
  innerClassName = "",
  children,
  "aria-label": ariaLabel,
}: {
  id?: string;
  tone?: Tone;
  rule?: boolean;
  className?: string;
  innerClassName?: string;
  children: ReactNode;
  "aria-label"?: string;
}) {
  return (
    <section
      id={id}
      aria-label={ariaLabel}
      className={`px-[clamp(16px,4vw,32px)] py-[clamp(72px,10vw,140px)] ${TONES[tone]} ${
        rule ? "border-t-2 border-mk-rule" : ""
      } ${className}`}
    >
      <div className={`mx-auto max-w-[1280px] ${innerClassName}`}>{children}</div>
    </section>
  );
}
