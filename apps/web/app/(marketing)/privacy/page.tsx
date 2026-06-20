import Link from "next/link";

export const metadata = {
  title: "Privacy Policy",
  description:
    "How Advertix collects, uses, stores, and protects your data when you use our AI-powered ad management platform.",
};

const EFFECTIVE_DATE = "June 15, 2026";
const CONTACT_EMAIL = "support@advertix.io";

export default function PrivacyPage() {
  return (
    <main className="bg-white text-slate-900">
      <LegalHero title="Privacy Policy" effectiveDate={EFFECTIVE_DATE} />
      <article className="mx-auto max-w-3xl px-6 py-12 lg:px-8">

        <Section title="1. Who we are">
          <p>
            Advertix (&ldquo;Advertix&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;,
            or &ldquo;our&rdquo;) is an AI-powered ad management platform
            operated by Abdul Qayyum. We help businesses plan, generate, launch,
            and optimize advertising campaigns across multiple platforms
            including Meta (Facebook, Instagram), Google, TikTok, and LinkedIn.
          </p>
          <p>
            This Privacy Policy describes how we collect, use, store, and
            protect your information when you use the Advertix service at{" "}
            <Link href="/" className="text-primary underline">
              advertix.io
            </Link>{" "}
            (the &ldquo;Service&rdquo;).
          </p>
        </Section>

        <Section title="2. Information we collect">
          <h3 className="mt-4 text-base font-semibold text-slate-900">
            2.1 Account information
          </h3>
          <p>
            When you create an Advertix account, we collect your email address,
            name, and profile picture (if provided) through our authentication
            provider Clerk. We do not store passwords directly &mdash; Clerk
            handles authentication and password storage.
          </p>

          <h3 className="mt-4 text-base font-semibold text-slate-900">
            2.2 Workspace information
          </h3>
          <p>
            We collect the workspace name, industry, team size, and other
            settings you provide during onboarding and in account settings.
          </p>

          <h3 className="mt-4 text-base font-semibold text-slate-900">
            2.3 Ad platform integrations
          </h3>
          <p>
            When you connect an ad account from Meta, Google, TikTok, or
            LinkedIn, you authorize Advertix to access your data on those
            platforms via their official OAuth flows. We receive and store:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-700">
            <li>
              An encrypted access token (and refresh token where applicable),
              encrypted using AES-256-CBC before storage
            </li>
            <li>
              Ad account identifiers, names, currency, and timezone metadata
            </li>
            <li>
              Campaign, ad set, creative, and ad data (names, budgets, statuses,
              targeting, schedules)
            </li>
            <li>
              Performance metrics (impressions, clicks, spend, conversions,
              revenue) at daily granularity
            </li>
          </ul>
          <p className="mt-2">
            We use these tokens only to perform the actions you explicitly
            request through the Advertix interface &mdash; reading your
            campaigns, creating ads on your behalf, and pulling performance
            data. We do not share these tokens with any third party.
          </p>

          <h3 className="mt-4 text-base font-semibold text-slate-900">
            2.4 Usage data
          </h3>
          <p>
            We collect basic usage information such as pages visited, features
            used, and timestamps. This is used to improve the Service and
            diagnose issues.
          </p>

          <h3 className="mt-4 text-base font-semibold text-slate-900">
            2.5 Cookies
          </h3>
          <p>
            We use cookies only for session management (provided by Clerk) and
            functional preferences. We do not use third-party advertising or
            tracking cookies on the Advertix platform itself.
          </p>
        </Section>

        <Section title="3. How we use your information">
          <ul className="list-disc space-y-1 pl-5 text-slate-700">
            <li>To provide, maintain, and improve the Advertix Service</li>
            <li>
              To execute campaign management actions you explicitly request
              (e.g. publishing an ad, pausing a campaign, syncing metrics)
            </li>
            <li>
              To generate AI-assisted campaign strategies, creative copy, and
              audience suggestions via the Anthropic Claude API
            </li>
            <li>To send transactional emails (account notifications, alerts)</li>
            <li>To respond to your support requests</li>
            <li>To detect, investigate, and prevent abuse or fraud</li>
            <li>To comply with legal obligations</li>
          </ul>
        </Section>

        <Section title="4. Third-party services">
          <p>The Advertix Service uses these third-party processors:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-700">
            <li>
              <strong>Clerk</strong> &mdash; authentication and user management
            </li>
            <li>
              <strong>Vercel</strong> &mdash; web frontend hosting
            </li>
            <li>
              <strong>Railway</strong> &mdash; backend API hosting
            </li>
            <li>
              <strong>Supabase / PostgreSQL</strong> &mdash; database
            </li>
            <li>
              <strong>Anthropic (Claude)</strong> &mdash; AI text generation
              when you use AI-assisted features. We send only the prompt content
              you provide; we do not send personal identifiers to Anthropic.
            </li>
            <li>
              <strong>Meta, Google, TikTok, LinkedIn</strong> &mdash; ad
              platforms you connect via OAuth. Data flow is governed by each
              platform&rsquo;s respective privacy policy.
            </li>
          </ul>
        </Section>

        <Section title="5. Data sharing and disclosure">
          <p>
            We do not sell or rent your personal information. We share data
            only:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-700">
            <li>
              With the third-party processors listed in Section 4, solely to
              operate the Service
            </li>
            <li>
              With ad platforms (Meta, Google, TikTok, LinkedIn) when you
              explicitly request an action that interacts with them
            </li>
            <li>To comply with valid legal requests or court orders</li>
            <li>
              In the event of a merger, acquisition, or asset sale, in which
              case affected users will be notified
            </li>
          </ul>
        </Section>

        <Section title="6. Data security">
          <p>We protect your data with the following measures:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-700">
            <li>
              Ad platform access tokens are encrypted at rest using AES-256-CBC
              with a SHA-256-derived 32-byte key. Tokens are never logged.
            </li>
            <li>
              All data in transit is encrypted via HTTPS / TLS 1.2+.
            </li>
            <li>
              Database is hosted in a secure managed environment with
              role-based access controls.
            </li>
            <li>
              Authentication is delegated to Clerk, which provides
              industry-standard security including SOC 2 Type II compliance and
              MFA support.
            </li>
          </ul>
          <p className="mt-2">
            No system is perfectly secure. While we make commercially
            reasonable efforts, we cannot guarantee absolute security.
          </p>
        </Section>

        <Section title="7. Data retention">
          <p>
            We retain your account data, workspace, and ad platform integration
            data for as long as your Advertix account is active. When you
            delete your account, we delete your data within 30 days, except
            where retention is required by law.
          </p>
          <p className="mt-2">
            You can revoke any ad platform integration at any time from
            Settings &rarr; Integrations. Doing so deletes the stored access
            token; previously synced campaign metadata may be retained for
            reporting unless you also delete the workspace.
          </p>
        </Section>

        <Section title="8. Your rights">
          <p>
            If you are located in the European Economic Area, United Kingdom,
            or another jurisdiction with similar protections, you have the
            following rights with respect to your personal data:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-700">
            <li>
              <strong>Access</strong> &mdash; request a copy of the personal
              data we hold about you
            </li>
            <li>
              <strong>Rectification</strong> &mdash; ask us to correct
              inaccurate or incomplete data
            </li>
            <li>
              <strong>Erasure</strong> &mdash; request deletion of your data
              (subject to legal retention requirements)
            </li>
            <li>
              <strong>Portability</strong> &mdash; receive your data in a
              structured, machine-readable format
            </li>
            <li>
              <strong>Restriction</strong> &mdash; ask us to limit how we use
              your data
            </li>
            <li>
              <strong>Objection</strong> &mdash; object to processing based on
              legitimate interests
            </li>
            <li>
              <strong>Withdraw consent</strong> &mdash; where processing is
              based on your consent
            </li>
          </ul>
          <p className="mt-2">
            To exercise any of these rights, email us at{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-primary underline"
            >
              {CONTACT_EMAIL}
            </a>
            . We will respond within 30 days.
          </p>
        </Section>

        <Section title="9. Children">
          <p>
            The Advertix Service is not directed to children under the age of
            13 (or 16 in the European Union). We do not knowingly collect
            information from children. If we learn we have collected
            information from a child, we will delete it.
          </p>
        </Section>

        <Section title="10. International transfers">
          <p>
            Advertix is operated from Pakistan. Your data may be processed in
            the United States, the European Union, and other regions where our
            third-party processors are located. We rely on standard
            contractual clauses and equivalent safeguards to protect data
            transferred internationally.
          </p>
        </Section>

        <Section title="11. Changes to this policy">
          <p>
            We may update this Privacy Policy from time to time. When we do, we
            will update the &ldquo;Effective date&rdquo; at the top and, for
            material changes, notify you by email or by a prominent notice on
            the Service before the change takes effect.
          </p>
        </Section>

        <Section title="12. Contact us">
          <p>For privacy questions or to exercise any of your rights:</p>
          <p className="mt-2">
            Email:{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-primary underline"
            >
              {CONTACT_EMAIL}
            </a>
          </p>
          <p className="mt-2">Operator: Advertix (operated by Abdul Qayyum)</p>
          <p>Jurisdiction: Pakistan</p>
        </Section>
      </article>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-bold tracking-tight text-slate-900">
        {title}
      </h2>
      <div className="mt-3 space-y-2 text-sm leading-relaxed text-slate-700">
        {children}
      </div>
    </section>
  );
}

function LegalHero({
  title,
  effectiveDate,
}: {
  title: string;
  effectiveDate: string;
}) {
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
          Legal
        </div>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">
          {title}
        </h1>
        <p className="mt-3 text-sm font-medium text-slate-400">
          Effective date: {effectiveDate}
        </p>
      </div>
    </section>
  );
}
