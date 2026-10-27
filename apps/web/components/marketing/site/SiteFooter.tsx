import Link from "next/link";
import Image from "next/image";
import { COPYRIGHT, FOOTER_COLUMNS, SUPPORT_EMAIL } from "@/lib/marketing/nav";

export function SiteFooter() {
  return (
    <footer className="px-[clamp(16px,4vw,32px)] pb-[clamp(28px,4vw,40px)] pt-[clamp(48px,7vw,72px)]">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-9">
        <div className="flex flex-wrap justify-between gap-x-14 gap-y-8 border-b-2 border-mk-rule pb-7">
          <div className="flex max-w-[320px] flex-[1_1_240px] flex-col gap-3">
            <Image src="/brand/advertix-logo-black.png" alt="Advertix" width={152} height={44} className="h-[clamp(34px,4vw,44px)] w-auto self-start dark:hidden" />
            <Image src="/brand/advertix-logo-white.png" alt="Advertix" width={152} height={44} className="hidden h-[clamp(34px,4vw,44px)] w-auto self-start dark:block" />
            <span className="text-sm text-mk-ink2">
              Give every advertiser a senior media buyer in their pocket.
            </span>
          </div>
          <nav
            aria-label="Footer"
            className="grid flex-[2_1_420px] grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-x-8 gap-y-6"
          >
            {FOOTER_COLUMNS.map((col) => (
              <div key={col.title} className="flex flex-col gap-2.5">
                <span className="font-mk-mono text-xs tracking-[.06em] text-mk-ink3">
                  {col.title}
                </span>
                {col.links.map((l) => (
                  <Link
                    key={l.label}
                    href={l.href}
                    className="text-[14.5px] text-mk-ink transition-colors hover:text-mk-brand"
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
            ))}
          </nav>
        </div>
        <div className="flex flex-wrap justify-between gap-2.5 font-mk-mono text-xs text-mk-ink3">
          <span>{COPYRIGHT}</span>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="uppercase transition-colors hover:text-mk-ink">
            {SUPPORT_EMAIL}
          </a>
        </div>
      </div>
    </footer>
  );
}
