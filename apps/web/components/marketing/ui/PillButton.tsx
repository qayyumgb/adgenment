import Link from "next/link";
import type { ReactNode } from "react";

export type PillVariant =
  | "brand"
  | "ink"
  | "outline"
  | "outline-soft"
  | "white"
  | "ghost-dark";

const VARIANTS: Record<PillVariant, string> = {
  brand: "bg-mk-brand text-white shadow-mk-brand hover:bg-mk-brand-hover",
  ink: "bg-mk-ink text-mk-paper hover:bg-mk-ink/90",
  outline: "border-[1.5px] border-mk-ink text-mk-ink hover:bg-mk-paper2",
  "outline-soft": "border-[1.5px] border-mk-line2 text-mk-ink hover:bg-mk-s2",
  white: "bg-white text-mk-on-light hover:bg-[#efebff]",
  "ghost-dark": "border-[1.5px] border-white/35 text-white hover:bg-white/[.08]",
};

/** Mockup pill CTA. Internal hrefs use next/link; others a plain anchor. */
export function PillButton({
  href,
  variant = "brand",
  className = "",
  children,
}: {
  href: string;
  variant?: PillVariant;
  className?: string;
  children: ReactNode;
}) {
  const cls = `inline-flex h-14 items-center justify-center whitespace-nowrap rounded-full px-6 font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-brand ${VARIANTS[variant]} ${className}`;
  if (href.startsWith("/")) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className={cls}>
      {children}
    </a>
  );
}
