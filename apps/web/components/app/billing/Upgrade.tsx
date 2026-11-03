"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { Check, Lock } from "lucide-react";
import type { PlanFeature } from "@/lib/api";
import { cn } from "@/lib/cn";
import { Button, ButtonLink, Card, Dialog } from "@/components/app/ui";
import { useAccess } from "@/components/app/team/access";
import { FEATURE_LABEL, FEATURE_TIER, TIER_LABEL, usePlan } from "./plan";

/**
 * Plan locks (C15): what people see instead of a feature their plan doesn't
 * include, and the lock screen when the trial ended without a plan. Owners
 * get the way to Billing; everyone else is told who can upgrade.
 */

const BILLING = "/settings?tab=billing";

/** "Client portal links come with the Agency plan." + the way to upgrade. */
export function UpgradeNote({ feature, why, className }: { feature: PlanFeature; why?: ReactNode; className?: string }) {
  const owner = useAccess().can("workspace");
  const tier = TIER_LABEL[FEATURE_TIER[feature]];
  return (
    <div className={cn("flex flex-wrap items-start gap-3 rounded-ctl border border-brand-soft-2 bg-brand-soft px-4 py-3.5", className)}>
      <span className="mt-0.5 inline-flex h-7 w-7 flex-none items-center justify-center rounded-full bg-surface text-brand" aria-hidden="true">
        <Lock size={14} />
      </span>
      <span className="flex min-w-0 flex-[1_1_240px] flex-col gap-0.5">
        <span className="text-sm font-semibold text-ink">
          {FEATURE_LABEL[feature]} come with the {tier} plan
        </span>
        <span className="text-[13px] text-ink-2">
          {why ? <>{why} </> : null}
          {owner ? "Upgrade to turn them on; your settings are kept." : "Ask a workspace owner to upgrade."}
        </span>
      </span>
      {owner && (
        <ButtonLink href={BILLING} variant="primary" size="sm" className="self-center">
          See plans
        </ButtonLink>
      )}
    </div>
  );
}

/** A settings card's stand-in. */
export function UpgradeCard({ feature, title, why }: { feature: PlanFeature; title: string; why: ReactNode }) {
  return (
    <Card padded={false} className="flex flex-col gap-3.5 p-[22px]">
      <span className="text-base font-semibold">{title}</span>
      <UpgradeNote feature={feature} why={why} />
    </Card>
  );
}

/** A dialog's stand-in (Share report, Schedule report). */
export function UpgradeDialog({ open, onClose, feature, title, why }: { open: boolean; onClose: () => void; feature: PlanFeature; title: string; why: ReactNode }) {
  return (
    <Dialog open={open} onClose={onClose} title={title} width={520} footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      <UpgradeNote feature={feature} why={why} />
    </Dialog>
  );
}

const longDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });

/** Instead of any page while the workspace is locked (Settings stays open). */
export function LockedScreen() {
  const access = useAccess();
  const owner = access.can("workspace");
  const { plan } = usePlan();
  const deletion = plan?.deletionScheduledAt ?? null;
  const kept = [
    "Your ads keep running on Meta, Google, TikTok and LinkedIn; Advertix doesn't touch them.",
    deletion ? "Your clients, campaigns, reports and settings are kept until then." : "Your clients, campaigns, reports and settings are kept.",
    plan?.accessRemovedAt
      ? "Choose a plan and everything comes back; reconnect your ad accounts in Connections (their access was removed after 30 days)."
      : "Choose a plan and everything comes back exactly as it was.",
  ];
  return (
    <div className="flex justify-center px-4 py-[clamp(32px,8vh,96px)]">
      <Card padded={false} className="flex w-full max-w-[560px] flex-col gap-5 p-[clamp(22px,4vw,32px)]">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft text-brand" aria-hidden="true">
          <Lock size={20} />
        </span>
        {deletion && (
          <div role="alert" className="rounded-ctl border border-neg/40 bg-neg-soft px-4 py-3 text-sm font-medium text-ink">
            This workspace will be deleted on {longDate(deletion)}. Choose a plan before then to keep it.
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <h1 className="m-0 text-[22px] font-semibold leading-tight [text-wrap:balance]">Your free trial has ended</h1>
          <p className="m-0 text-sm text-ink-2 [text-wrap:pretty]">
            {owner
              ? "Choose a plan to keep using Advertix. Until then, syncing, AI, reports and automation (including safety rules and spend caps) are paused."
              : "An owner of this workspace needs to choose a plan to keep using Advertix. Until then, syncing, AI, reports and automation are paused."}
          </p>
        </div>
        <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[13px] text-ink-2">
          {kept.map((k) => (
            <li key={k} className="flex items-start gap-2">
              <Check size={15} className="mt-0.5 flex-none text-pos" aria-hidden="true" />
              {k}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          {owner ? (
            <ButtonLink href={BILLING} variant="primary">
              Choose a plan
            </ButtonLink>
          ) : null}
          <ButtonLink href="/settings" variant="secondary">
            Settings
          </ButtonLink>
          <ButtonLink href="mailto:support@advertix.io" variant="ghost" size="md">
            Contact us
          </ButtonLink>
        </div>
      </Card>
    </div>
  );
}

/** The app frame while locked: logo, Billing and Settings, account menu. No sidebar (its pages are closed). */
export function LockedShell({ children }: { children: ReactNode }) {
  const owner = useAccess().can("workspace");
  const link = (href: string, label: string) => (
    <Link href={href} className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-ink-2 no-underline transition-colors hover:bg-surface-2 hover:text-ink">
      {label}
    </Link>
  );
  return (
    <div className="flex min-h-screen flex-col bg-bg text-sm leading-normal text-ink">
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-surface px-[clamp(16px,4vw,32px)]">
        <Link href="/settings" className="flex flex-none items-center" aria-label="Advertix">
          <Image src="/brand/advertix-logo-black.png" alt="Advertix" width={103} height={30} priority className="h-[26px] w-auto dark:hidden" />
          <Image src="/brand/advertix-logo-white.png" alt="Advertix" width={103} height={30} priority className="hidden h-[26px] w-auto dark:block" />
        </Link>
        <nav aria-label="Account" className="ml-2 flex items-center gap-1">
          {owner && link(BILLING, "Billing")}
          {link("/settings", "Settings")}
        </nav>
        <span className="flex-1" />
        <UserButton appearance={{ elements: { avatarBox: "h-[34px] w-[34px]" } }} />
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
