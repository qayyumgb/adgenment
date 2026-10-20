import type { ReactNode } from "react";

/** Mono uppercase label above headings. */
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
      className={`font-mk-mono text-xs uppercase tracking-[.06em] ${
        onDark ? "text-mk-lav-ink" : "text-mk-brand-ink"
      } ${className}`}
    >
      {children}
    </span>
  );
}

/** Serif-italic accent phrase used at the end of most headlines. */
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
    <span className={`font-mk-serif font-normal italic ${color} ${className}`}>{children}</span>
  );
}

/**
 * Section heading: sans lead + serif-italic accent.
 * Size matches the mockups' h2 (clamp 34→68px).
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
      className={`m-0 text-[clamp(34px,5.2vw,68px)] font-medium leading-[.98] tracking-[-0.05em] [text-wrap:balance] ${className}`}
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

/** Eyebrow + heading on the left, lede on the right, bottom-aligned. */
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
    <div className={`flex flex-wrap items-end justify-between gap-x-16 gap-y-6 ${className}`}>
      <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-4">
        {eyebrow && <Eyebrow onDark={onDark}>{eyebrow}</Eyebrow>}
        <AccentHeading lead={lead} accent={accent} onDark={onDark} accentTone={accentTone} />
      </div>
      {lede && (
        <p
          data-reveal="up"
          className={`m-0 max-w-[420px] flex-[1_1_320px] text-[clamp(16px,1.6vw,18px)] ${
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
 * Hero h1: two masked lines that rise in on load. Line two is the
 * serif-italic accent.
 */
export function HeroTitle({
  line1,
  line2,
  line2ClassName = "text-mk-brand",
  className = "text-[clamp(46px,9vw,112px)]",
}: {
  line1: ReactNode;
  line2: ReactNode;
  line2ClassName?: string;
  className?: string;
}) {
  return (
    <h1 className={`m-0 font-medium leading-[.92] tracking-[-0.055em] ${className}`}>
      <span className="-mb-[.14em] block overflow-hidden pb-[.18em]">
        <span data-reveal="line" className="inline-block">
          {line1}
        </span>
      </span>
      <span className="-mb-[.1em] block overflow-hidden pb-[.22em]">
        <span
          data-reveal="line"
          className={`inline-block font-mk-serif font-normal italic tracking-[-0.03em] ${line2ClassName}`}
        >
          {line2}
        </span>
      </span>
    </h1>
  );
}
