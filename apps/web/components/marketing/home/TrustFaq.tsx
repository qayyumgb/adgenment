import { AccentHeading, Eyebrow } from "@/components/marketing/ui/Heading";
import { FaqAccordion } from "@/components/marketing/ui/FaqAccordion";

// TODO(copy): confirm each claim before launch (plan § 2, item 8).
const TRUST = [
  { v: "AES-256", l: "encryption on every OAuth token at rest" },
  { v: "MFA", l: "Clerk-hardened sign-in and session controls" },
  { v: "7 days", l: "to undo any change, by a person or the AI" },
  { v: "0", l: "models trained on your data, ever" },
];

const FAQS = [
  {
    q: "Will Advertix change my campaigns without asking?",
    a: "Only if you allow it. By default it suggests and you approve. Per client, you can let small changes apply on their own inside a daily guardrail, and undo anything for 7 days.",
  },
  {
    q: "What exactly does the AI do?",
    a: "Statistical models find the signals in your platform data. Claude turns them into plain-language decisions, plans and copy, and cites the numbers it used. Your guardrails decide what applies.",
  },
  {
    q: "Which platforms work today?",
    a: "Meta, Google, TikTok and LinkedIn connect through their official APIs with two-way sync. Snapchat is rolling out now.",
  },
  {
    q: "Do you train AI models on my data?",
    a: "No. Your data runs your workspace and nothing else. You can disconnect any platform instantly and request deletion at any time.",
  },
  {
    q: "Is it for agencies or single brands?",
    a: "Both. Agencies get a client switcher, per-client caps and autonomy, and white-label reports. A founder gets the same AI with a simpler setup.",
  },
];

export function TrustFaq() {
  return (
    <section className="px-[clamp(16px,4vw,32px)] py-[clamp(72px,10vw,136px)]">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-[clamp(36px,5vw,56px)]">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] border-t-2 border-mk-rule">
          {TRUST.map((t) => (
            <div key={t.v} data-reveal="up" className="flex flex-col gap-2 border-b border-mk-hair py-6 pr-[22px]">
              <span className="text-[clamp(40px,4.6vw,58px)] font-medium leading-[.95] tracking-[-0.045em]">{t.v}</span>
              <span className="text-[15px] text-mk-ink2">{t.l}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-[clamp(28px,5vw,64px)]">
          <div className="flex flex-[1_1_320px] flex-col gap-3">
            <Eyebrow>QUESTIONS</Eyebrow>
            <AccentHeading lead="Before you" accent="connect anything." accentTone="ink" />
          </div>
          <FaqAccordion items={FAQS} defaultOpen={0} variant="large" className="min-w-0 flex-[1.4_1_460px]" />
        </div>
      </div>
    </section>
  );
}
