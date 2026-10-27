"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { Eyebrow, HeroTitle } from "@/components/marketing/ui/Heading";
import { SegmentedControl } from "@/components/marketing/ui/SegmentedControl";
import { DEMO_HREF, SIGN_UP_HREF } from "@/lib/marketing/nav";
import { PLANS, kMoney, yearlyMonthly, type Plan } from "@/lib/marketing/pricing";

const SPEND = [5_000, 10_000, 15_000, 25_000, 40_000, 60_000, 80_000, 100_000, 150_000, 200_000, 250_000, 400_000, 600_000];

/** Hero (with billing toggle), plan finder and plan cards share state. */
export function PricingPlans() {
  const [annual, setAnnual] = useState(true);
  const [spendIx, setSpendIx] = useState(5);
  const [clients, setClients] = useState(4);
  const id = useId();

  const spend = SPEND[spendIx];
  const spendLabel = kMoney(spend) + (spendIx === SPEND.length - 1 ? "+" : "");
  const fit = PLANS.find((p) => spend <= p.spendLimit && clients <= p.clientLimit)!;
  const price = (p: Plan) => (p.monthly == null ? "Custom" : `$${annual ? yearlyMonthly(p.monthly) : p.monthly}`);
  const why =
    fit.monthly == null
      ? "Above $250k a month or 10 clients, we tailor limits and support."
      : `Covers ${clients} ${clients === 1 ? "brand" : "brands"} and ${kMoney(spend)} a month, with room to grow to ${kMoney(fit.spendLimit)}.`;

  return (
    <>
      <section className="mk-grid-bg border-b-2 border-mk-rule px-[clamp(16px,4vw,32px)] pb-[clamp(36px,5vw,56px)] pt-[clamp(48px,8vw,104px)]">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-end justify-between gap-x-16 gap-y-7">
          <div className="flex min-w-0 flex-[1_1_600px] flex-col gap-[18px]">
            <Eyebrow>PRICING · FREE DURING BETA</Eyebrow>
            <HeroTitle
              line1="Pay for what you manage."
              line2="Not a cut of your spend."
              className="text-[clamp(44px,8.6vw,108px)]"
            />
          </div>
          <div data-reveal="up" className="flex max-w-[400px] flex-[1_1_300px] flex-col gap-4">
            <p className="m-0 text-mk-ink2">
              Flat monthly plans. Ad spend is billed by each platform, as it is today. Beta workspaces keep 30% off for
              their first year.
            </p>
            <SegmentedControl
              label="Billing period"
              tone="paper"
              value={annual ? "yearly" : "monthly"}
              onChange={(v) => setAnnual(v === "yearly")}
              className="self-start"
              itemClassName="!text-sm"
              options={[
                { value: "monthly", label: "Monthly" },
                {
                  value: "yearly",
                  label: (
                    <>
                      Yearly
                      <span className="rounded-full bg-mk-pos-soft px-[7px] py-0.5 font-mk-mono text-[11px] text-mk-pos">−2 MO</span>
                    </>
                  ),
                },
              ]}
            />
          </div>
        </div>
      </section>

      <section className="px-[clamp(16px,4vw,32px)] pt-[clamp(40px,6vw,72px)]">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-12 gap-y-7 rounded-[28px] bg-mk-band p-[clamp(20px,3.4vw,36px)] text-mk-on-dark">
          <div className="flex min-w-0 flex-[1.3_1_380px] flex-col gap-[18px]">
            <span className="font-mk-mono text-xs tracking-[.06em] text-mk-lav">FIND YOUR PLAN</span>
            <label htmlFor={`${id}-spend`} className="flex flex-col gap-2">
              <span className="flex justify-between text-sm text-[#b4b0c4]">
                <span>Monthly ad spend you manage</span>
                <span className="font-mk-mono text-white">{spendLabel} / MO</span>
              </span>
              <input
                id={`${id}-spend`}
                type="range"
                min={0}
                max={SPEND.length - 1}
                value={spendIx}
                onChange={(e) => setSpendIx(+e.target.value)}
                aria-valuetext={`${spendLabel} per month`}
                className="m-0 w-full"
              />
            </label>
            <label htmlFor={`${id}-clients`} className="flex flex-col gap-2">
              <span className="flex justify-between text-sm text-[#b4b0c4]">
                <span>Brands or clients</span>
                <span className="font-mk-mono text-white">{clients}</span>
              </span>
              <input
                id={`${id}-clients`}
                type="range"
                min={1}
                max={25}
                value={clients}
                onChange={(e) => setClients(+e.target.value)}
                aria-valuetext={`${clients} ${clients === 1 ? "brand" : "brands"}`}
                className="m-0 w-full"
              />
            </label>
          </div>
          <div
            aria-live="polite"
            className="flex flex-[1_1_280px] flex-col gap-1.5 rounded-[20px] border border-mk-lav-ink/25 bg-[linear-gradient(135deg,rgba(138,63,252,.32),rgba(45,140,255,.18))] p-5"
          >
            <span className="font-mk-mono text-[11.5px] tracking-[.06em] text-[#d9d2ff]">BEST FIT</span>
            <span className="text-[clamp(30px,3.6vw,42px)] font-medium leading-[1.05] tracking-[-0.04em]">
              {fit.name}{" "}
              <span className="font-mk-serif font-normal italic text-[#d9d2ff]">
                {price(fit)}
                {fit.monthly == null ? "" : "/mo"}
              </span>
            </span>
            <span className="text-sm text-[#d6d2e2]">{why}</span>
          </div>
        </div>
      </section>

      <section className="px-[clamp(16px,4vw,32px)] pb-[clamp(56px,8vw,104px)] pt-[clamp(28px,4vw,48px)]">
        <div className="mx-auto grid max-w-[1280px] grid-cols-1 items-stretch gap-3.5 mk-sm:grid-cols-2 min-[1180px]:grid-cols-4">
          {PLANS.map((p) => {
            const rec = p === fit;
            const dark = p.name === "Agency";
            const custom = p.monthly == null;
            return (
              <div
                key={p.name}
                data-reveal="rise"
                className={`relative flex flex-col gap-4 rounded-[26px] p-6 transition-[box-shadow,border-color] duration-[350ms] ${
                  dark ? "bg-mk-band text-mk-on-dark" : "bg-mk-paper2 text-mk-ink"
                } ${
                  rec
                    ? "border-2 border-mk-brand shadow-[0_0_0_5px_rgb(var(--mk-soft)),0_40px_80px_-40px_rgba(100,72,242,.55)]"
                    : dark
                      ? "border border-mk-ink"
                      : "border border-mk-hair"
                }`}
              >
                <div className="flex items-center gap-2">
                  <h2 className="m-0 text-xl font-semibold">{p.name}</h2>
                  <span className="flex-1" />
                  {rec && (
                    <span className="rounded-full bg-[linear-gradient(115deg,#8a3ffc,#5d5cff_50%,#2d8cff)] px-[9px] py-[3px] font-mk-mono text-[11px] tracking-[.04em] text-white">
                      BEST FIT
                    </span>
                  )}
                </div>
                <span className={`-mt-2 text-sm ${dark ? "text-mk-on-dark2" : "text-mk-ink3"}`}>{p.for}</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[52px] font-medium leading-none tracking-[-0.05em]">{price(p)}</span>
                  <span className={`text-sm ${dark ? "text-mk-on-dark2" : "text-mk-ink3"}`}>
                    {custom ? "" : annual ? "/ mo, yearly" : "/ month"}
                  </span>
                </div>
                <span className={`font-mk-mono text-[11.5px] tracking-[.02em] ${dark ? "text-mk-on-dark2" : "text-mk-ink3"}`}>
                  {p.limits}
                </span>
                <Link
                  href={custom ? DEMO_HREF : SIGN_UP_HREF}
                  className={`flex h-[50px] items-center justify-between rounded-full px-[18px] font-semibold transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-brand ${
                    dark || rec ? "bg-mk-brand text-white" : "border-[1.5px] border-mk-line2 text-mk-ink"
                  }`}
                >
                  {custom ? "Talk to sales" : "Start free"}
                  <span aria-hidden="true">→</span>
                </Link>
                <div className={`h-px ${dark ? "bg-white/10" : "bg-mk-hair"}`} />
                <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                  {p.items.map((it) => (
                    <li key={it} className="flex items-start gap-2.5 text-[14.5px] leading-[1.45]">
                      <span aria-hidden="true" className={`mt-0.5 flex-none text-xs ${dark ? "text-mk-lav" : "text-mk-brand"}`}>
                        ✓
                      </span>
                      <span className="min-w-0 flex-1">{it}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
