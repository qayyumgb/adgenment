"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { HEADER_LINKS, LIVE_TICKER, SIGN_UP_HREF } from "@/lib/marketing/nav";

const GUTTER = "px-[clamp(16px,4vw,32px)]";

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    // The menu only exists below 960px; close it if the viewport grows.
    const mq = window.matchMedia("(min-width: 960px)");
    const onWide = () => mq.matches && setOpen(false);
    window.addEventListener("keydown", onKey);
    mq.addEventListener("change", onWide);
    return () => {
      window.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onWide);
    };
  }, [open]);

  const isCurrent = (href: string) => pathname === href;

  return (
    <header className="sticky top-0 z-[100] border-b border-mk-hair bg-mk-paper/[.86] backdrop-blur-[12px] backdrop-saturate-[1.4]">
      <div className={`mx-auto flex h-16 max-w-[1280px] items-center gap-5 ${GUTTER}`}>
        <Link href="/" className="flex flex-none" aria-label="Advertix home">
          <Image
            src="/brand/advertix-logo-black.png"
            alt="Advertix"
            width={83}
            height={24}
            priority
            className="block h-6 w-auto"
          />
        </Link>

        <span className="hidden items-center gap-2 whitespace-nowrap font-mk-mono text-xs tracking-[.04em] text-mk-ink3 mk-2xl:inline-flex">
          <span className="relative h-[7px] w-[7px]" aria-hidden="true">
            <span className="absolute inset-0 rounded-full bg-mk-pos" />
            <span className="absolute inset-0 animate-mk-ping rounded-full bg-mk-pos" />
          </span>
          {LIVE_TICKER}
        </span>

        <span className="flex-1" />

        <nav aria-label="Main" className="hidden gap-6 text-sm font-medium mk-lg:flex">
          {HEADER_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={isCurrent(l.href) ? "page" : undefined}
              className="whitespace-nowrap text-mk-ink2 transition-colors hover:text-mk-ink aria-[current=page]:text-mk-ink"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <Link
          href={SIGN_UP_HREF}
          className="inline-flex h-[42px] items-center whitespace-nowrap rounded-full bg-mk-ink px-[18px] text-sm font-semibold text-mk-paper transition-colors hover:bg-[#2d2a35]"
        >
          Start free
        </Link>

        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mk-mobile-menu"
          className="flex h-11 w-11 flex-none items-center justify-center rounded-full border-[1.5px] border-mk-ink text-mk-ink mk-lg:hidden"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            {open ? (
              <>
                <path d="M6 6l12 12" />
                <path d="M18 6L6 18" />
              </>
            ) : (
              <>
                <path d="M4 9h16" />
                <path d="M4 15h16" />
              </>
            )}
          </svg>
        </button>
      </div>

      {open && (
        <nav
          id="mk-mobile-menu"
          aria-label="Main"
          className={`flex flex-col border-t-2 border-mk-rule bg-mk-paper pb-5 pt-1 mk-lg:hidden ${GUTTER}`}
        >
          {HEADER_LINKS.map((l, i) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              aria-current={isCurrent(l.href) ? "page" : undefined}
              className="flex items-center justify-between border-b border-mk-hair py-4 text-2xl font-medium leading-[1.1] tracking-[-0.025em] text-mk-ink"
            >
              {l.label}
              <span className="font-mk-mono text-[13px] text-mk-ink3">
                {String(i + 1).padStart(2, "0")}
              </span>
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
