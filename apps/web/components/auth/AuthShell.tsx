import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { AuthVisual } from "./AuthVisual";
import "./auth.css";

/**
 * Sign-in / sign-up layout: a clean, centred brand panel on the left
 * (desktop): logo, headline, three stacked product cards with small
 * animations. The Clerk form on the right. On phones only the form shows,
 * under the logo.
 */

const COPY = {
  "sign-in": {
    title: "Your clients' ads, in one calm place.",
    sub: "Plan, launch and optimise campaigns for every client. Advertix suggests the changes; you approve them, with one-click undo.",
  },
  "sign-up": {
    title: "Run every client's ads from one place.",
    sub: "Every feature is included for 14 days. Connect an ad account, and Advertix shows what to change first.",
  },
} as const;

export function AuthShell({ mode, children }: { mode: keyof typeof COPY; children: ReactNode }) {
  const copy = COPY[mode];
  return (
    <div className="grid min-h-screen bg-bg lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* Brand panel */}
      <aside className="hidden border-r border-line bg-surface lg:flex lg:flex-col lg:items-center lg:justify-center lg:px-10 lg:py-12 xl:px-16">
        <div className="flex w-full max-w-[520px] flex-col items-center text-center">
          <a href="https://advertix.io" className="adx-auth-rise" aria-label="Advertix home">
            <Image src="/brand/advertix-logo-black.png" alt="Advertix" width={124} height={36} priority className="h-9 w-auto dark:hidden" />
            <Image src="/brand/advertix-logo-white.png" alt="Advertix" width={124} height={36} priority className="hidden h-9 w-auto dark:block" />
          </a>
          <h1 className="adx-auth-rise m-0 mt-8 text-[34px] [text-wrap:balance] font-semibold leading-[1.15] tracking-[-0.025em] text-ink xl:text-[38px]">{copy.title}</h1>
          <p className="adx-auth-rise m-0 mt-4 max-w-[440px] text-[15px] leading-relaxed text-ink-2">{copy.sub}</p>
          <div className="mt-10 flex w-full justify-center [@media(max-height:780px)]:mt-7">
            <AuthVisual />
          </div>
        </div>
      </aside>

      {/* Form */}
      <main className="flex min-h-screen flex-col px-4 py-6 sm:px-8">
        <div className="lg:hidden">
          <Image src="/brand/advertix-logo-black.png" alt="Advertix" width={110} height={32} priority className="h-8 w-auto dark:hidden" />
          <Image src="/brand/advertix-logo-white.png" alt="Advertix" width={110} height={32} priority className="hidden h-8 w-auto dark:block" />
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 py-8">{children}</div>
        <p className="m-0 text-center text-xs text-ink-3">
          © {new Date().getFullYear()} Advertix ·{" "}
          <Link href="/privacy" className="hover:text-ink-2">
            Privacy
          </Link>{" "}
          ·{" "}
          <Link href="/terms" className="hover:text-ink-2">
            Terms
          </Link>
        </p>
      </main>
    </div>
  );
}

/** Clerk's sign-in / sign-up card in Advertix's look (style objects win over Clerk's own CSS). */
export const clerkAppearance = {
  variables: {
    colorPrimary: "#6448f2",
    colorText: "#16141f",
    colorTextSecondary: "#595669",
    colorInputText: "#16141f",
    borderRadius: "10px",
    fontFamily: "inherit",
    fontSize: "14px",
  },
  elements: {
    rootBox: { width: "100%", display: "flex", justifyContent: "center" },
    cardBox: {
      width: "100%",
      maxWidth: "400px",
      borderRadius: "16px",
      border: "1px solid rgba(22, 20, 31, 0.08)",
      boxShadow: "0 1px 2px rgba(22, 20, 31, 0.04), 0 16px 40px -18px rgba(22, 20, 31, 0.18)",
    },
    card: { boxShadow: "none", border: "none", padding: "32px 28px 24px" },
    headerTitle: { fontSize: "21px", fontWeight: 650, letterSpacing: "-0.01em" },
    headerSubtitle: { color: "#595669" },
    socialButtonsBlockButton: { height: "42px", borderColor: "rgba(22, 20, 31, 0.14)", fontWeight: 500 },
    formFieldInput: { height: "42px" },
    formButtonPrimary: { height: "42px", fontSize: "14px", fontWeight: 600, textTransform: "none", boxShadow: "none" },
    footerActionLink: { color: "#4b2fd0", fontWeight: 600 },
  },
} as const;
