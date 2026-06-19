"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Sparkles, Menu, X, ArrowRight } from "lucide-react";

const NAV_LINKS = [
  { href: "/features", label: "Features" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function MarketingNav() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 transition-all">
      <div
        className={`mx-auto mt-3 max-w-6xl px-4 transition-all duration-300 ${
          scrolled ? "sm:mt-2" : "sm:mt-4"
        }`}
      >
        <div
          className={`flex items-center justify-between gap-4 rounded-full border px-4 py-2.5 backdrop-blur-xl transition-all ${
            scrolled
              ? "border-slate-200/80 bg-white/90 shadow-lg shadow-slate-900/5"
              : "border-white/15 bg-slate-900/40 shadow-2xl shadow-slate-950/30"
          }`}
        >
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2"
            aria-label="Advertix home"
          >
            <BrandMark />
            <span
              className={`text-base font-bold tracking-tight ${
                scrolled ? "text-slate-900" : "text-white"
              }`}
            >
              Advertix
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                    scrolled
                      ? active
                        ? "bg-slate-100 text-slate-900"
                        : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                      : active
                        ? "bg-white/10 text-white"
                        : "text-white/85 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/sign-in"
              className={`hidden rounded-full px-4 py-1.5 text-sm font-semibold transition-colors sm:inline-flex ${
                scrolled
                  ? "text-slate-700 hover:text-slate-900"
                  : "text-white/85 hover:text-white"
              }`}
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="group inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-indigo-600/30 transition hover:from-indigo-400 hover:to-violet-500 hover:shadow-xl hover:shadow-indigo-600/40"
            >
              Get started
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" strokeWidth={2.5} />
            </Link>

            <button
              type="button"
              onClick={() => setOpen((s) => !s)}
              className={`md:hidden ${
                scrolled ? "text-slate-700" : "text-white"
              }`}
              aria-label="Toggle menu"
            >
              {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {open && (
          <div className="mt-2 overflow-hidden rounded-3xl border border-slate-200 bg-white p-3 shadow-2xl shadow-slate-900/10 md:hidden">
            <nav className="flex flex-col">
              {NAV_LINKS.map((link) => {
                const active = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`rounded-2xl px-4 py-3 text-base font-semibold ${
                      active
                        ? "bg-indigo-50 text-indigo-700"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
              <div className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
                <Link
                  href="/sign-in"
                  className="rounded-full border border-slate-200 px-4 py-2.5 text-center text-sm font-bold text-slate-700"
                >
                  Sign in
                </Link>
                <Link
                  href="/sign-up"
                  className="rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 px-4 py-2.5 text-center text-sm font-bold text-white"
                >
                  Get started
                </Link>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}

function BrandMark() {
  return (
    <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 shadow-lg shadow-indigo-600/40">
      <Sparkles className="h-4 w-4 text-white" strokeWidth={2.5} />
      <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/20" />
    </div>
  );
}
