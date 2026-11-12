import type { ReactNode } from "react";

/** Small uppercase label above headings (sans, semibold; 2026-11 refresh: no mono). */
export function Eyebrow({
  children,
  onDark = false,
  className = "",
}: {
  children: ReactNode;
  onDark?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`text-[12.5px] font-semibold uppercase tracking-[.09em] ${
        onDark ? "text-mk-lav-ink" : "text-mk-brand-ink"
      } ${className}`}
    >
      {children}
    </span>
  );
}

/** Accent phrase at the end of a headline: same typeface, brand colour (2026-11 refresh: no serif italic). */
export function Accent({
  children,
  onDark = false,
  tone,
  className = "",
}: {
  children: ReactNode;
  onDark?: boolean;
  /** Override the default colour (brand on paper, lavender on dark). */
  tone?: "brand" | "ink" | "lav";
  className?: string;
}) {
  const color =
    tone === "ink"
      ? "text-mk-ink"
      : tone === "lav" || (onDark && !tone)
        ? "text-mk-lav"
        : "text-mk-brand";
  return (
    <span className={`${color} ${className}`}>{children}</span>
  );
}

/**
 * Section heading: lead + accent phrase in the brand colour.
 * clamp 30→52px, semibold.
 */
export function AccentHeading({
  lead,
  accent,
  as: Tag = "h2",
  onDark = false,
  accentTone,
  reveal = true,
  className = "",
}: {
  lead: ReactNode;
  accent?: ReactNode;
  as?: "h1" | "h2" | "h3";
  onDark?: boolean;
  accentTone?: "brand" | "ink" | "lav";
  reveal?: boolean;
  className?: string;
}) {
  return (
    <Tag
      data-reveal={reveal ? "up" : undefined}
      className={`m-0 text-[clamp(30px,4.4vw,52px)] font-semibold leading-[1.05] tracking-[-0.035em] [text-wrap:balance] ${className}`}
    >
      {lead}
      {accent && (
        <>
          {" "}
          <Accent onDark={onDark} tone={accentTone}>
            {accent}
          </Accent>
        </>
      )}
    </Tag>
  );
}

/** Eyebrow, heading, and the lede right under it (2026-11 refresh: no floating right column). */
export function SectionHead({
  eyebrow,
  lead,
  accent,
  lede,
  onDark = false,
  accentTone,
  className = "",
}: {
  eyebrow?: ReactNode;
  lead: ReactNode;
  accent?: ReactNode;
  lede?: ReactNode;
  onDark?: boolean;
  accentTone?: "brand" | "ink" | "lav";
  className?: string;
}) {
  return (
    <div className={`flex max-w-[820px] flex-col gap-4 ${className}`}>
      <div className="flex min-w-0 flex-col gap-4">
        {eyebrow && <Eyebrow onDark={onDark}>{eyebrow}</Eyebrow>}
        <AccentHeading lead={lead} accent={accent} onDark={onDark} accentTone={accentTone} />
      </div>
      {lede && (
        <p
          data-reveal="up"
          className={`m-0 max-w-[640px] text-[clamp(16px,1.6vw,18px)] ${
            onDark ? "text-mk-on-dark2" : "text-mk-ink2"
          }`}
        >
          {lede}
        </p>
      )}
    </div>
  );
}

/**
 * Hero h1: two masked lines that rise in on load; line two in the brand
 * colour, same typeface (2026-11 refresh).
 */
export function HeroTitle({
  line1,
  line2,
  line2ClassName = "text-mk-brand",
  className = "text-[clamp(40px,6.2vw,76px)]",
}: {
  line1: ReactNode;
  line2: ReactNode;
  line2ClassName?: string;
  className?: string;
}) {
  return (
    <h1 className={`m-0 font-semibold leading-[1.02] tracking-[-0.04em] [text-wrap:balance] ${className}`}>
      <span className="-mb-[.14em] block overflow-hidden pb-[.18em]">
        <span data-reveal="line" className="inline-block">
          {line1}
        </span>
      </span>
      <span className="-mb-[.1em] block overflow-hidden pb-[.22em]">
        <span
          data-reveal="line"
          className={`inline-block ${line2ClassName}`}
        >
          {line2}
        </span>
      </span>
    </h1>
  );
}
