import Link from "next/link";
import { Trash2, Mail, Clock, ShieldCheck, AlertCircle } from "lucide-react";

export const metadata = {
  title: "Data Deletion Instructions",
  description:
    "How to request deletion of your Advertix account and all associated data.",
};

const CONTACT_EMAIL = "support@advertix.io";

export default function DataDeletionPage() {
  return (
    <main className="bg-white text-slate-900">
      <Hero />
      <article className="mx-auto max-w-3xl px-6 py-12 lg:px-8">
        <Intro />
        <OptionA />
        <OptionB />
        <WhatGetsDeleted />
        <Timeframe />
        <MetaSpecific />
        <Contact />
      </article>
    </main>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[#0B1319] via-indigo-950 to-[#0B1319] pb-16 pt-32 sm:pt-36">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 top-0 h-72 w-72 rounded-full bg-indigo-600/25 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 bottom-0 h-72 w-72 rounded-full bg-violet-600/25 blur-3xl"
      />
      <div className="relative mx-auto max-w-3xl px-6 text-center lg:px-8">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-semibold text-white/85 backdrop-blur">
          <Trash2 className="h-3 w-3" strokeWidth={2.5} />
          Data deletion
        </div>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Delete your data
        </h1>
        <p className="mt-3 text-sm font-medium text-slate-400">
          How to remove your Advertix account and all associated data
        </p>
      </div>
    </section>
  );
}

function Intro() {
  return (
    <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-5 text-sm leading-relaxed text-slate-700">
      <p>
        You have the right to delete your Advertix account and all data
        associated with it at any time. There are two ways to do this. Both are
        free, both are immediate, both result in complete removal of your data
        within 30 days.
      </p>
    </div>
  );
}

function OptionA() {
  return (
    <Section
      icon={ShieldCheck}
      title="Option A — Delete from your account settings (recommended)"
      description="Fastest. You control the timing and confirm the action yourself."
    >
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-700">
        <li>
          Sign in at{" "}
          <Link
            href="https://app.advertix.io/sign-in"
            className="font-semibold text-indigo-600 underline hover:text-indigo-700"
          >
            app.advertix.io/sign-in
          </Link>
        </li>
        <li>
          Go to <strong>Settings</strong> (top-right user menu → Settings)
        </li>
        <li>
          Scroll to the <strong>Danger Zone</strong> section at the bottom
        </li>
        <li>
          Click <strong>&quot;Delete my account&quot;</strong> and confirm the
          action
        </li>
        <li>
          Your account is deactivated immediately. All data is permanently
          purged within 30 days.
        </li>
      </ol>
    </Section>
  );
}

function OptionB() {
  return (
    <Section
      icon={Mail}
      title="Option B — Email us to request deletion"
      description="Use this if you can't sign in, lost access to your account, or prefer to put it in writing."
    >
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-700">
        <li>
          Send an email to{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=Data%20deletion%20request`}
            className="font-semibold text-indigo-600 underline hover:text-indigo-700"
          >
            {CONTACT_EMAIL}
          </a>{" "}
          from the email address registered with your Advertix account
        </li>
        <li>
          Subject line: <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">Data deletion request</code>
        </li>
        <li>
          Include the following in the body:
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Your full name as it appears on the account</li>
            <li>The email address associated with the account</li>
            <li>
              (Optional) The reason for deletion — helps us improve, but is not
              required
            </li>
          </ul>
        </li>
        <li>
          We will confirm receipt within <strong>2 business days</strong> and
          complete deletion within <strong>30 days</strong>
        </li>
      </ol>
    </Section>
  );
}

function WhatGetsDeleted() {
  return (
    <Section
      icon={Trash2}
      title="What gets deleted"
      description="The full list of data we remove when you delete your account."
    >
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-700">
        <li>Your Advertix account (email, name, profile information)</li>
        <li>Your workspace and all workspace settings</li>
        <li>
          Connected ad-platform OAuth tokens (Meta, Google, TikTok, LinkedIn) —
          these are revoked and deleted from our database
        </li>
        <li>Campaigns, ad sets, creatives, and creative assets you uploaded</li>
        <li>Performance metrics and historical reports</li>
        <li>Audience definitions you created within Advertix</li>
        <li>
          AI conversation history (any prompts you sent to the Advertix AI
          planner)
        </li>
        <li>Any uploaded images or media</li>
        <li>Support communications and account notifications</li>
      </ul>
      <div className="mt-4 rounded-xl bg-amber-50 p-3 ring-1 ring-amber-200">
        <div className="flex items-start gap-2">
          <AlertCircle
            className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
            strokeWidth={2.5}
          />
          <p className="text-xs leading-relaxed text-amber-900">
            <strong>Important:</strong> Deleting your Advertix account does{" "}
            <strong>not</strong> delete the campaigns, ads, or data that live on
            Meta / Google / TikTok / LinkedIn directly. Those remain in your ad
            platform accounts. To delete them on each platform, sign in to that
            platform directly and manage there.
          </p>
        </div>
      </div>
    </Section>
  );
}

function Timeframe() {
  return (
    <Section
      icon={Clock}
      title="Timeframe"
      description="When deletion happens and what we keep briefly for legal compliance."
    >
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-700">
        <p>
          <strong>Immediately:</strong> Your account is deactivated. You can no
          longer sign in or be reached through Advertix.
        </p>
        <p>
          <strong>Within 7 days:</strong> Your OAuth tokens are revoked and
          purged from our database. Connected ad-platform integrations are
          severed.
        </p>
        <p>
          <strong>Within 30 days:</strong> All personal data, campaigns,
          metrics, creatives, and AI history are permanently deleted from
          production databases and backups.
        </p>
        <p>
          <strong>Up to 90 days:</strong> We retain encrypted, anonymized log
          fragments solely to comply with applicable tax, financial, or legal
          obligations. These contain no personally identifying information and
          are purged automatically.
        </p>
      </div>
    </Section>
  );
}

function MetaSpecific() {
  return (
    <Section
      icon={ShieldCheck}
      title="Deleting only your Meta (Facebook) integration"
      description="If you want to keep your Advertix account but revoke Meta access only."
    >
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-700">
        <li>
          Sign in at{" "}
          <Link
            href="https://app.advertix.io/sign-in"
            className="font-semibold text-indigo-600 underline hover:text-indigo-700"
          >
            app.advertix.io
          </Link>
        </li>
        <li>
          Go to <strong>Settings → Integrations</strong>
        </li>
        <li>
          Find the <strong>Meta</strong> connection → click{" "}
          <strong>Disconnect</strong>
        </li>
        <li>
          Your Meta OAuth token is immediately revoked and purged from our
          systems
        </li>
      </ol>
      <p className="mt-3 text-sm leading-relaxed text-slate-700">
        Alternatively, you can revoke Advertix from Meta&apos;s side: go to{" "}
        <a
          href="https://www.facebook.com/settings?tab=business_tools"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-indigo-600 underline hover:text-indigo-700"
        >
          Facebook Settings → Business Integrations
        </a>{" "}
        → find Advertix → Remove. Meta will notify us automatically and we will
        purge the token within 7 days.
      </p>
    </Section>
  );
}

function Contact() {
  return (
    <Section
      icon={Mail}
      title="Questions or help with deletion"
      description="If anything is unclear or you need help completing the deletion."
    >
      <p className="mt-3 text-sm leading-relaxed text-slate-700">
        Email{" "}
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="font-semibold text-indigo-600 underline hover:text-indigo-700"
        >
          {CONTACT_EMAIL}
        </a>{" "}
        and we&apos;ll respond within 2 business days.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-slate-700">
        Operated by Abdul Qayyum · Karachi, Pakistan
      </p>
    </Section>
  );
}

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Mail;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/10 to-violet-500/10 text-indigo-600 ring-1 ring-inset ring-indigo-100">
          <Icon className="h-5 w-5" strokeWidth={2.25} />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            {title}
          </h2>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </div>
      </div>
      <div className="mt-2">{children}</div>
    </section>
  );
}
