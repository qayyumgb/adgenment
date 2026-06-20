import Link from "next/link";

export const metadata = {
  title: "Terms of Service",
  description:
    "The terms governing your use of the Advertix AI-powered ad management platform.",
};

const EFFECTIVE_DATE = "June 15, 2026";
const CONTACT_EMAIL = "support@advertix.io";

export default function TermsPage() {
  return (
    <main className="bg-white text-slate-900">
      <LegalHero title="Terms of Service" effectiveDate={EFFECTIVE_DATE} />
      <article className="mx-auto max-w-3xl px-6 py-12 lg:px-8">
        <p className="text-sm leading-relaxed text-slate-700">
          These Terms of Service (&ldquo;Terms&rdquo;) form a binding agreement
          between you and Advertix (operated by Abdul Qayyum,
          &ldquo;Advertix&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) governing
          your use of advertix.io and the Advertix AI ad management platform
          (the &ldquo;Service&rdquo;). By creating an account or using the
          Service, you agree to these Terms.
        </p>

        <Section title="1. The Service">
          <p>
            Advertix provides an AI-powered platform for managing advertising
            campaigns across multiple platforms including Meta (Facebook,
            Instagram), Google, TikTok, and LinkedIn. Features include
            connecting ad accounts via OAuth, viewing campaign performance,
            generating AI-assisted strategies and creatives, and creating ads
            on connected platforms on your behalf.
          </p>
          <p className="mt-2">
            Advertix is not affiliated with, sponsored by, or endorsed by Meta,
            Google, TikTok, LinkedIn, or any other ad platform. All trademarks
            and service marks are the property of their respective owners.
          </p>
        </Section>

        <Section title="2. Eligibility and accounts">
          <p>
            You must be at least 18 years old (or the age of majority in your
            jurisdiction) and capable of forming a binding contract to use the
            Service. The Service is not intended for children under 13.
          </p>
          <p className="mt-2">
            You are responsible for maintaining the confidentiality of your
            account credentials and for all activity that occurs under your
            account. Notify us immediately at{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-primary underline"
            >
              {CONTACT_EMAIL}
            </a>{" "}
            if you suspect unauthorized access.
          </p>
        </Section>

        <Section title="3. Your content and licenses">
          <p>
            You retain ownership of all content you submit to the Service,
            including campaign names, creative copy, audience definitions, and
            uploaded images (&ldquo;Your Content&rdquo;). You grant Advertix a
            limited, non-exclusive, worldwide license to process, display, and
            transmit Your Content solely as needed to provide the Service to
            you.
          </p>
          <p className="mt-2">
            You represent and warrant that you own or have the necessary rights
            to Your Content and that it does not infringe any third-party
            intellectual property or privacy rights.
          </p>
        </Section>

        <Section title="4. Acceptable use">
          <p>You agree not to use the Service to:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-700">
            <li>Violate any applicable law or regulation</li>
            <li>
              Run advertising campaigns that promote illegal products or
              services, hate speech, harassment, fraud, or misleading claims
            </li>
            <li>
              Infringe intellectual property rights, including by uploading
              creative assets you do not own or have licensed
            </li>
            <li>
              Distribute malware, spam, or unauthorized commercial content
            </li>
            <li>
              Attempt to gain unauthorized access to other accounts or to our
              systems
            </li>
            <li>
              Reverse engineer, decompile, or copy the Service except as
              expressly permitted by law
            </li>
            <li>
              Use the Service to send unsolicited commercial communications
            </li>
            <li>
              Submit false, misleading, or fraudulent information to ad
              platforms via Advertix
            </li>
          </ul>
          <p className="mt-2">
            You are responsible for complying with each ad platform&rsquo;s own
            advertising policies (e.g. Meta Advertising Standards, Google Ads
            policies) when running campaigns through Advertix.
          </p>
        </Section>

        <Section title="5. Ad platform connections">
          <p>
            When you connect an ad platform account to Advertix, you authorize
            us to access and act on that account on your behalf using the
            scopes you grant. You can revoke this access at any time from
            Settings &rarr; Integrations or directly on the ad platform.
          </p>
          <p className="mt-2">
            You are solely responsible for any ad spend, charges, fees, or
            actions taken on ad platforms through your Advertix-connected
            account, including those initiated through the Advertix interface.
          </p>
        </Section>

        <Section title="6. AI-generated content">
          <p>
            Advertix uses third-party AI models (currently provided by
            Anthropic) to generate campaign strategies, ad copy, audience
            suggestions, and other content. AI-generated content is provided as
            a starting point and is not guaranteed to be accurate, complete, or
            suitable for any specific purpose. You are responsible for reviewing
            and verifying any AI-generated content before using it.
          </p>
          <p className="mt-2">
            We do not claim ownership of AI-generated outputs. You may use them
            as you see fit, subject to applicable laws and the policies of any
            ad platforms involved.
          </p>
        </Section>

        <Section title="7. Fees and payment">
          <p>
            Advertix may offer free and paid plans. Paid plans are billed in
            advance on a recurring basis according to the plan selected. Fees
            are non-refundable except as required by law or as explicitly stated
            in our pricing terms at the time of purchase.
          </p>
          <p className="mt-2">
            Ad spend on connected platforms is billed directly by those
            platforms to your payment method on file with them &mdash; Advertix
            does not collect or remit ad spend.
          </p>
        </Section>

        <Section title="8. Suspension and termination">
          <p>
            We may suspend or terminate your access to the Service at any time
            if we reasonably believe you have violated these Terms, abused the
            Service, or are using it in a way that may cause harm to other
            users, ad platforms, or third parties.
          </p>
          <p className="mt-2">
            You may delete your account at any time from Settings &rarr;
            Danger Zone. Upon deletion, we will remove your data within 30
            days, except where retention is legally required.
          </p>
          <p className="mt-2">
            Sections that by their nature should survive termination &mdash;
            including Sections 3, 9, 10, 11, 12, and 13 &mdash; will continue
            to apply after termination.
          </p>
        </Section>

        <Section title="9. Disclaimers">
          <p>
            The Service is provided &ldquo;AS IS&rdquo; and &ldquo;AS
            AVAILABLE&rdquo; without warranties of any kind, express or
            implied, including warranties of merchantability, fitness for a
            particular purpose, non-infringement, or uninterrupted operation.
          </p>
          <p className="mt-2">
            We do not warrant that AI-generated content will be accurate or
            free of errors. We do not warrant that campaigns published through
            Advertix will achieve any particular performance result, conversion
            rate, or return on ad spend.
          </p>
        </Section>

        <Section title="10. Limitation of liability">
          <p>
            To the maximum extent permitted by law, Advertix and its operator
            will not be liable for any indirect, incidental, special,
            consequential, or punitive damages, or for lost profits, lost
            revenue, lost ad spend, or lost data, arising from or related to
            your use of the Service.
          </p>
          <p className="mt-2">
            Our total liability to you for any claim arising from these Terms
            or the Service will not exceed the greater of (a) the amount you
            paid to Advertix in the 12 months preceding the claim, or (b) USD
            $100.
          </p>
          <p className="mt-2">
            Some jurisdictions do not allow the exclusion of certain warranties
            or limitations of liability. To the extent any such exclusion is
            not enforceable, the remainder of this Section will continue to
            apply.
          </p>
        </Section>

        <Section title="11. Indemnification">
          <p>
            You agree to indemnify and hold Advertix harmless from any claim,
            demand, loss, or damage, including reasonable legal fees, arising
            from (a) Your Content, (b) your use of the Service in violation of
            these Terms or applicable law, or (c) your violation of any
            third-party rights, including any ad platform&rsquo;s terms of
            service.
          </p>
        </Section>

        <Section title="12. Governing law and disputes">
          <p>
            These Terms are governed by the laws of the Islamic Republic of
            Pakistan, without regard to conflict of law principles. Any dispute
            arising from these Terms or the Service will be resolved in the
            courts of Karachi, Sindh, Pakistan, unless prohibited by applicable
            consumer protection law.
          </p>
        </Section>

        <Section title="13. Changes to the Terms">
          <p>
            We may update these Terms from time to time. Material changes will
            be communicated by email or by a prominent notice on the Service at
            least 14 days before the change takes effect. Continued use of the
            Service after the effective date constitutes acceptance of the
            updated Terms. If you do not agree to the updated Terms, you should
            stop using the Service and delete your account.
          </p>
        </Section>

        <Section title="14. Miscellaneous">
          <p>
            These Terms, together with our{" "}
            <Link href="/privacy" className="text-primary underline">
              Privacy Policy
            </Link>
            , constitute the entire agreement between you and Advertix
            regarding the Service. If any provision is held unenforceable, the
            remaining provisions will continue in effect. Our failure to
            enforce any right or provision will not be a waiver of that right
            or provision.
          </p>
          <p className="mt-2">
            You may not assign or transfer these Terms without our prior
            written consent. We may assign these Terms to a successor in
            connection with a merger, acquisition, or asset sale.
          </p>
        </Section>

        <Section title="15. Contact">
          <p>For questions about these Terms:</p>
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
