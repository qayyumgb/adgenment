/**
 * Marketing-site navigation. One source for the header, the mobile menu,
 * the footer and the sitemap, so links can't drift between them.
 *
 * `/sign-in` and `/sign-up` are relative on purpose: on the apex domain the
 * middleware forwards them to app.advertix.io, and in local dev / Vercel
 * previews every route lives on the same host.
 */

export type NavLink = { label: string; href: string };

export const SIGN_UP_HREF = "/sign-up";
export const SIGN_IN_HREF = "/sign-in";
export const DEMO_HREF = "/contact#demo";

export const HEADER_LINKS: NavLink[] = [
  { label: "Product", href: "/product" },
  { label: "How it works", href: "/how-it-works" },
  { label: "For agencies", href: "/agencies" },
  { label: "Pricing", href: "/pricing" },
  { label: "About", href: "/about" },
  { label: "Sign in", href: SIGN_IN_HREF },
];

export const FOOTER_COLUMNS: { title: string; links: NavLink[] }[] = [
  {
    title: "PRODUCT",
    links: [
      { label: "Product", href: "/product" },
      { label: "How it works", href: "/how-it-works" },
      { label: "The AI", href: "/#ai" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    title: "SOLUTIONS",
    links: [
      { label: "For agencies", href: "/agencies" },
      { label: "For founders", href: "/pricing" },
    ],
  },
  {
    title: "COMPANY",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "LEGAL",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "Data deletion", href: "/data-deletion" },
    ],
  },
];

export const SUPPORT_EMAIL = "support@advertix.io";

// TODO(copy): confirm the legal entity name before launch — the current
// Privacy/Terms pages name an individual operator, not "Advertix, Inc."
// (docs/MARKETING_REDESIGN_PLAN.md § 2, item 6).
export const COPYRIGHT = "© 2026 ADVERTIX, INC.";

/** Static header badge, kept as designed (decision 2026-10-20). */
export const LIVE_TICKER = "LIVE · 23 ACCOUNTS · CHECKED 4 MIN AGO";
