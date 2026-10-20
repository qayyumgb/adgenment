import type { Metadata } from "next";
import { AccentHeading, Eyebrow, HeroTitle } from "@/components/marketing/ui/Heading";
import { ContactCard } from "@/components/marketing/contact/ContactCard";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Book a 20-minute Advertix demo on one of your real ad accounts, or send us a message. We reply within one working day.",
};

// TODO(copy): confirm these inboxes exist before launch (plan § 2, item 8).
const CHANNELS = [
  { t: "support@advertix.io", b: "Product help and account questions" },
  { t: "sales@advertix.io", b: "Plans, agency onboarding, Enterprise" },
  { t: "security@advertix.io", b: "Responsible disclosure and data requests" },
];

const CALL = [
  { t: "0:00", h: "Your setup", b: "Clients, platforms and roughly what you spend each month." },
  { t: "0:05", h: "Connect one account", b: "Read-only for the demo. Advertix pulls 90 days in a few minutes." },
  { t: "0:12", h: "Your first decisions", b: "We walk through what it finds on your own numbers." },
  { t: "0:18", h: "Next steps", b: "Plan fit, onboarding for the rest of your book, or nothing at all." },
];

export default function ContactPage() {
  return (
    <>
      <section className="border-b-2 border-mk-rule px-[clamp(16px,4vw,32px)] pb-[clamp(48px,7vw,88px)] pt-[clamp(48px,8vw,104px)]">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-start gap-[clamp(32px,5vw,64px)]">
          <div className="flex min-w-0 flex-[1_1_400px] flex-col gap-5">
            <Eyebrow>CONTACT · REPLIES WITHIN ONE WORKING DAY</Eyebrow>
            <HeroTitle line1="Talk to people" line2="who run ads." className="text-[clamp(44px,8vw,100px)]" />
            <p data-reveal="up" className="m-0 max-w-[460px] text-[clamp(16px,1.6vw,18px)] text-mk-ink2">
              Book 20 minutes and we’ll look at one of your real accounts together, or send a note and we’ll reply within
              a working day.
            </p>
            <div className="mt-2 flex flex-col border-t-2 border-mk-rule">
              {CHANNELS.map((c) => (
                <a
                  key={c.t}
                  href={`mailto:${c.t}`}
                  data-reveal="rise"
                  className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 border-b border-mk-hair py-4 text-mk-ink transition-colors hover:text-mk-brand-ink"
                >
                  <span className="text-[17px] font-medium tracking-[-0.015em]">{c.t}</span>
                  <span aria-hidden="true" className="row-span-2 self-center text-lg">
                    →
                  </span>
                  <span className="text-sm text-mk-ink2">{c.b}</span>
                </a>
              ))}
            </div>
          </div>
          <ContactCard />
        </div>
      </section>

      <section className="px-[clamp(16px,4vw,32px)] py-[clamp(64px,9vw,120px)]">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-[clamp(28px,4vw,44px)]">
          <div className="flex flex-col gap-3">
            <Eyebrow>ON THE CALL</Eyebrow>
            <AccentHeading lead="Twenty minutes," accent="your own numbers." className="!text-[clamp(34px,5vw,64px)]" />
          </div>
          <ol className="m-0 grid list-none grid-cols-1 border-t-2 border-mk-rule p-0 mk-sm:grid-cols-2 mk-xl:grid-cols-4">
            {CALL.map((c) => (
              <li key={c.t} data-reveal="rise" className="flex flex-col gap-2.5 border-b border-mk-hair py-6 pr-6">
                <span className="font-mk-mono text-[13px] text-mk-brand-ink">{c.t}</span>
                <span className="text-[21px] font-medium tracking-[-0.025em]">{c.h}</span>
                <span className="text-[15px] text-mk-ink2">{c.b}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
