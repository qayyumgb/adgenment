import Link from "next/link";
import {
  Mail,
  MessageCircle,
  AtSign,
  MapPin,
  Clock,
  Sparkles,
  ArrowRight,
  Shield,
} from "lucide-react";
import { GradientMesh } from "@/components/marketing/GradientMesh";
import { ContactForm } from "./ContactForm";

export const metadata = {
  title: "Contact",
  description:
    "Get in touch with the Advertix team. Questions, partnerships, support — we read every email.",
};

const CHANNELS = [
  {
    icon: Mail,
    title: "Email",
    description: "We answer within 24 hours, often sooner.",
    value: "support@advertix.io",
    href: "mailto:support@advertix.io",
  },
  {
    icon: MessageCircle,
    title: "Sales & partnerships",
    description: "For agency / enterprise inquiries.",
    value: "hello@advertix.io",
    href: "mailto:hello@advertix.io",
  },
  {
    icon: AtSign,
    title: "Social",
    description: "We're most active on Twitter / X.",
    value: "@advertix",
    href: "https://twitter.com/advertix",
  },
];

export default function ContactPage() {
  return (
    <main className="bg-white text-slate-900">
      <ContactHero />
      <ContactBody />
      <FAQTeaser />
    </main>
  );
}

function ContactHero() {
  return (
    <section className="relative isolate overflow-hidden pb-32 pt-28 sm:pt-32 lg:pb-40 lg:pt-36">
      <GradientMesh />
      <div className="relative mx-auto max-w-4xl px-6 text-center lg:px-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3.5 py-1.5 text-xs font-semibold text-white/90 backdrop-blur-sm">
          <Sparkles className="h-3 w-3 text-indigo-300" strokeWidth={2.5} />
          We're listening
        </div>
        <h1 className="mt-6 text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-[64px]">
          Get in touch with
          <br />
          <span className="bg-gradient-to-r from-indigo-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
            the team.
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
          Got a question, a feature idea, a partnership, or something that's
          broken? Drop a line — every message reaches a real human, usually
          within hours.
        </p>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-[#F6F6FD]" />
    </section>
  );
}

function ContactBody() {
  return (
    <section className="bg-[#F6F6FD] pb-20 pt-4">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[1.4fr,1fr]">
          {/* Form card */}
          <div className="overflow-hidden rounded-[36px] bg-white p-8 shadow-sm sm:p-12">
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-indigo-700">
              <Mail className="h-3 w-3" strokeWidth={2.5} />
              Send a message
            </div>
            <h2 className="mt-4 text-2xl font-bold text-[#0B1319] sm:text-3xl">
              Tell us what's on your mind
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              We read every message. Most replies go out within 24 hours.
            </p>

            <ContactForm />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Channels */}
            <div className="overflow-hidden rounded-[36px] bg-[#0B1319] p-8 text-white shadow-sm sm:p-10">
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-300">
                Other ways to reach us
              </div>
              <div className="mt-5 space-y-5">
                {CHANNELS.map((c) => (
                  <a
                    key={c.title}
                    href={c.href}
                    target={c.href.startsWith("http") ? "_blank" : undefined}
                    rel={c.href.startsWith("http") ? "noopener noreferrer" : undefined}
                    className="group flex items-start gap-3"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-indigo-300 ring-1 ring-inset ring-white/10 transition group-hover:bg-indigo-500/20 group-hover:text-white">
                      <c.icon className="h-4 w-4" strokeWidth={2.25} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-white">{c.title}</div>
                      <div className="text-xs text-slate-400">{c.description}</div>
                      <div className="mt-1 truncate text-xs font-semibold text-indigo-300 group-hover:text-indigo-200">
                        {c.value}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>

            {/* Where + when */}
            <div className="overflow-hidden rounded-[36px] bg-white p-8 shadow-sm sm:p-10">
              <div className="space-y-4 text-sm">
                <InfoRow
                  icon={MapPin}
                  label="Operated from"
                  value="Karachi, Pakistan"
                />
                <InfoRow
                  icon={Clock}
                  label="Working hours"
                  value="Mon–Fri · 09:00–18:00 PKT"
                  sub="(Replies often go out outside hours too)"
                />
                <InfoRow
                  icon={Shield}
                  label="Privacy"
                  value="We never share your message"
                  sub="Read our Privacy Policy"
                  href="/privacy"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  sub,
  href,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
  sub?: string;
  href?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100">
        <Icon className="h-4 w-4" strokeWidth={2.25} />
      </div>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          {label}
        </div>
        <div className="text-sm font-bold text-[#0B1319]">{value}</div>
        {sub &&
          (href ? (
            <Link
              href={href}
              className="mt-0.5 inline-block text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              {sub}
            </Link>
          ) : (
            <div className="mt-0.5 text-xs text-slate-500">{sub}</div>
          ))}
      </div>
    </div>
  );
}

const FAQS = [
  {
    q: "Is Advertix free during beta?",
    a: "Yes. No credit card required. We'll give 30 days notice before introducing paid plans.",
  },
  {
    q: "Which ad platforms are supported?",
    a: "Meta (Facebook, Instagram), Google Ads, TikTok Ads, and LinkedIn — all native API integrations.",
  },
  {
    q: "Do you train AI on my campaigns?",
    a: "No. We never train models on customer campaigns and never share data with third parties.",
  },
  {
    q: "Can I revoke access to my ad accounts?",
    a: "Yes — instantly, from Settings → Integrations, or from the platform directly.",
  },
];

function FAQTeaser() {
  return (
    <section className="bg-[#F6F6FD] pb-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[44px] bg-white px-6 py-12 shadow-sm sm:px-12 sm:py-16 lg:px-20">
          <div className="mx-auto max-w-2xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-indigo-700">
              FAQ
            </div>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-[#0B1319] sm:text-4xl">
              Quick answers before you write
            </h2>
            <p className="mt-3 text-base text-slate-600">
              The four questions we get asked most.
            </p>
          </div>

          <dl className="mx-auto mt-12 max-w-3xl space-y-4">
            {FAQS.map((f) => (
              <details
                key={f.q}
                className="group rounded-2xl border border-slate-200 bg-slate-50 p-5 transition open:border-indigo-200 open:bg-indigo-50/30"
              >
                <summary className="flex cursor-pointer items-center justify-between gap-4 text-left text-sm font-bold text-[#0B1319]">
                  {f.q}
                  <span className="ml-2 text-indigo-600 transition group-open:rotate-45">
                    <ArrowRight className="h-4 w-4 -rotate-45" strokeWidth={3} />
                  </span>
                </summary>
                <dd className="mt-3 text-sm leading-relaxed text-slate-600">
                  {f.a}
                </dd>
              </details>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
