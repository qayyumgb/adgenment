"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useAppRouter } from "@/hooks/useAppRouter";
import { useAccess } from "@/components/app/team/access";
import toast from "react-hot-toast";
import { AlertTriangle, ChevronRight, Copy, ExternalLink, MoreHorizontal, Rocket, Trash2 } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useApiClient, type Campaign } from "@/lib/api";
import { cn } from "@/lib/cn";
import { fmtMoney } from "@/lib/money";
import { PageBody, PageHeader, PageTabs } from "@/components/app/shell/PageHeader";
import { useClientScope } from "@/components/app/shell/ClientContext";
import { Button, ButtonLink, Card, EmptyState, IconButton, Menu, PlatformBadge, Skeleton, StatusPill, PLATFORM_META, type PlatformKey } from "@/components/app/ui";
import { useCampaignStructure } from "@/components/app/campaign/structure";
import { AdSetsTab, AdsTab } from "@/components/app/campaign/StructureViews";
import { objectiveLabel } from "@/components/app/campaigns/CampaignsGrid";
import { canToggle, isLiveOnMeta, isReadOnlySync, needsPublish, useCampaignMutations } from "@/components/app/campaigns/useCampaignMutations";
import { dailySeries, dayLabel } from "@/components/app/campaign/metrics";
import { OverviewTab } from "@/components/app/campaign/OverviewTab";
import { SettingsTab } from "@/components/app/campaign/SettingsTab";
import { HistoryTab } from "@/components/app/campaign/HistoryTab";
import { DuplicateDialog } from "@/components/app/campaign/DuplicateDialog";

/**
 * Campaign detail (guide §5.3, plan A6): header with status switch, tabs
 * Overview / Ad sets / Ads / Change log / Settings (tab in `?tab=`), 6 KPIs vs
 * the previous 30 days, daily metric chart, suggestions, "Ask about this
 * campaign", ad sets and ads (B4, Meta), daily breakdown. Publish goes to the New campaign wizard
 * (`/campaigns/new?from=<id>`; old `?publish=1` links redirect there). Ads Manager link,
 * launch / pause on Meta, rename / budget / delete.
 */

const TABS = ["overview", "adsets", "ads", "log", "settings"] as const;
type Tab = (typeof TABS)[number];
const STATUS_LABEL: Record<Campaign["status"], string> = { ACTIVE: "Active", PAUSED: "Paused", DRAFT: "Draft", ENDED: "Ended" };

const shortDate = (iso: string) => dayLabel(iso.slice(0, 10));

// Ads Manager keys off Meta's own numeric account id, not our internal id.
const adsManagerUrl = (c: Campaign) =>
  `https://business.facebook.com/adsmanager/manage/campaigns?act=${c.adAccount?.accountId}&selected_campaign_ids=${c.externalId}`;

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const searchParams = useSearchParams();
  const router = useAppRouter();
  const access = useAccess();
  const canEdit = access.can("edit");
  const api = useApiClient();
  const { clients } = useClientScope();
  const tabParam = searchParams.get("tab");
  const tab: Tab = (TABS as readonly string[]).includes(tabParam ?? "") ? (tabParam as Tab) : "overview";

  const campaignQ = useApi((c) => c.getCampaign(id), [id], { key: "campaign" });
  const metricsQ = useApi((c) => c.getCampaignMetrics(id, 60), [id], { key: "campaign-metrics" });
  const refetch = () => {
    void campaignQ.refetch();
    void metricsQ.refetch();
  };
  const mutations = useCampaignMutations(refetch);
  const structure = useCampaignStructure(id, () => void campaignQ.refetch());
  const [duplicateOpen, setDuplicateOpen] = useState(false);

  const c = campaignQ.data;
  const rows = metricsQ.data;
  const current = useMemo(() => dailySeries(rows ?? [], 30), [rows]);
  const previous = useMemo(() => dailySeries(rows ?? [], 30, 30), [rows]);

  // Old `?publish=1` links: publishing now happens in the New campaign wizard.
  const autoPublish = searchParams.get("publish") === "1";
  useEffect(() => {
    if (autoPublish && c && needsPublish(c)) router.replace(`/campaigns/new?from=${c.id}`);
  }, [autoPublish, c, router]);

  if (campaignQ.loading) {
    return (
      <>
        <div className="flex flex-col gap-2 border-b border-line bg-surface px-[clamp(16px,4vw,32px)] pb-3.5 pt-3">
          <Skeleton className="h-3 w-48" />
          <Skeleton className="h-7 w-72 max-w-full" />
          <Skeleton className="h-3.5 w-96 max-w-full" />
        </div>
        <PageBody>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[110px] rounded-card" />
            ))}
          </div>
          <Skeleton className="h-[340px] rounded-card" />
        </PageBody>
      </>
    );
  }

  if (campaignQ.error || !c) {
    return (
      <PageBody>
        <EmptyState
          title="Campaign not found"
          body={campaignQ.error ?? "This campaign isn’t in your workspace, or you don’t have access to it."}
          action={<ButtonLink href="/campaigns" variant="secondary">Back to Campaigns</ButtonLink>}
        />
      </PageBody>
    );
  }

  const currency = c.adAccount?.currency ?? null;
  const client = clients.find((x) => x.id === c.adAccount?.clientId);
  const live = isLiveOnMeta(c);
  const platformName = PLATFORM_META[c.platform as PlatformKey]?.name ?? c.platform;
  const since = c.startDate ?? c.publishedAt;
  const budget = Number(c.budget) || 0;
  const summary = [
    [platformName, objectiveLabel(c.objective)].filter(Boolean).join(" · "),
    since && c.status !== "DRAFT" ? `${c.status === "ENDED" ? "Ran from" : "Live since"} ${shortDate(since)}` : null,
    c.adAccount ? `${c.adAccount.accountName}${c.adAccount.accountId ? ` · ${c.adAccount.accountId}` : ""}` : null,
    budget > 0 ? `${fmtMoney(budget, currency, { whole: true })}${c.budgetType === "DAILY" ? "/day" : " lifetime"}` : null,
  ]
    .filter(Boolean)
    .join(" • ");
  const toggleable = canToggle(c) && canEdit;
  const toggleReason = !canEdit
    ? access.why("edit")
    : isReadOnlySync(c)
    ? `Change the status in ${platformName}`
    : needsPublish(c)
      ? "Publish to Meta first"
      : c.status === "DRAFT" || c.status === "ENDED"
        ? `${STATUS_LABEL[c.status]} campaigns can't be paused or resumed`
        : undefined;

  const remove = async () => {
    const warning = live
      ? `Delete "${c.name}"?\n\nThis deletes the campaign ON META too — its ad set and ad stop delivering immediately — along with its metrics here. This cannot be undone.`
      : `Delete "${c.name}"? This removes its metrics and creative links. This cannot be undone.`;
    if (!window.confirm(warning)) return;
    try {
      await api.deleteCampaign(c.id);
      toast.success(live ? "Campaign deleted here and on Meta" : "Campaign deleted");
      router.push("/campaigns");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const tabHref = (t: Tab) => (t === "overview" ? `/campaigns/${c.id}` : `/campaigns/${c.id}?tab=${t}`);

  return (
    <>
      <PageHeader
        kicker={
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 whitespace-nowrap">
            <Link href="/campaigns" className="flex-none text-inherit no-underline hover:text-brand">
              Campaigns
            </Link>
            {client && !client.isDefault && (
              <>
                <ChevronRight size={12} aria-hidden="true" />
                <span className="min-w-0 max-w-[30%] truncate">{client.name}</span>
              </>
            )}
            <ChevronRight size={12} aria-hidden="true" />
            <span className="min-w-0 truncate font-medium text-ink">{c.name}</span>
          </nav>
        }
        title={
          <span className="flex items-start gap-2.5">
            <span className="mt-0.5 flex-none">
              <PlatformBadge platform={c.platform as PlatformKey} size={26} />
            </span>
            <span className="min-w-0 break-words">
              {c.name}
              <StatusPill status={STATUS_LABEL[c.status]} className="ml-2.5 inline-flex -translate-y-0.5 align-middle text-xs" />
            </span>
          </span>
        }
        summary={summary}
        actions={
          <>
            <Button
              variant="secondary"
              role="switch"
              aria-checked={c.status === "ACTIVE"}
              disabled={!toggleable || mutations.busy(c.id)}
              title={toggleReason}
              onClick={() => void mutations.toggle(c)}
              className="pl-2.5"
            >
              <span aria-hidden="true" className={cn("relative h-5 w-[34px] flex-none rounded-full transition-colors", c.status === "ACTIVE" ? "bg-brand" : "bg-line-2")}>
                <span className={cn("absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,.2)] transition-transform", c.status === "ACTIVE" && "translate-x-[14px]")} />
              </span>
              {c.status === "ACTIVE" ? "Pause" : live && c.status === "PAUSED" ? "Resume on Meta" : "Resume"}
            </Button>
            <Button variant="secondary" icon={<Copy size={16} />} onClick={() => setDuplicateOpen(true)} disabled={!canEdit} title={canEdit ? undefined : access.why("edit")}>
              Duplicate
            </Button>
            {live && c.adAccount?.accountId && (
              <ButtonLink
                href={adsManagerUrl(c)}
                variant="secondary"
                icon={<ExternalLink size={16} />}
                target="_blank"
                rel="noopener noreferrer"
                title="Open in Meta Ads Manager"
                aria-label="Open in Meta Ads Manager"
                className="max-[1279px]:w-10 max-[1279px]:px-0"
              >
                <span className="max-[1279px]:hidden">Ads Manager</span>
              </ButtonLink>
            )}
            {!canEdit ? null : needsPublish(c) ? (
              <Button variant="primary" icon={<Rocket size={16} />} onClick={() => router.push(`/campaigns/new?from=${c.id}`)}>
                Publish to Meta
              </Button>
            ) : (
              <ButtonLink href={tabHref("settings")} variant="primary">
                Edit campaign
              </ButtonLink>
            )}
            {canEdit && <Menu
              align="end"
              width={200}
              trigger={(p) => (
                <IconButton {...p} label="More actions" size={38}>
                  <MoreHorizontal size={18} />
                </IconButton>
              )}
            >
              {(close) => (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => (close(), void remove())}
                  className="flex w-full items-center gap-2.5 rounded-ctl px-2.5 py-[9px] text-left text-sm text-neg hover:bg-neg-soft focus-visible:bg-neg-soft focus-visible:outline-none"
                >
                  <Trash2 size={15} />
                  Delete campaign
                </button>
              )}
            </Menu>}
          </>
        }
        tabs={
          <PageTabs
            label="Campaign sections"
            active={tab}
            tabs={[
              { id: "overview", label: "Overview", href: tabHref("overview") },
              { id: "adsets", label: "Ad sets", href: tabHref("adsets"), count: structure.data?.adSets.length || undefined },
              { id: "ads", label: "Ads", href: tabHref("ads"), count: structure.data?.ads.length || undefined },
              { id: "log", label: "Change log", href: tabHref("log") },
              { id: "settings", label: "Settings", href: tabHref("settings") },
            ]}
          />
        }
      />
      <PageBody className="gap-5">
        {c.publishError && c.platform === "META" && (
          <Card className="flex items-start gap-3 border-neg/40 bg-neg-soft">
            <AlertTriangle size={18} className="mt-0.5 flex-none text-neg" aria-hidden="true" />
            <div className="min-w-0 flex-1 text-sm">
              <div className="font-semibold text-neg">The last publish attempt failed</div>
              <div className="mt-0.5 text-ink-2">{c.publishError}</div>
              <div className="mt-1 text-xs text-ink-2">Anything created on Meta during that attempt was rolled back. Use Publish to Meta to try again.</div>
            </div>
          </Card>
        )}

        {tab === "overview" && <OverviewTab campaign={c} current={current} previous={previous} loading={metricsQ.loading} onChanged={refetch} structure={structure} />}
        {tab === "adsets" && <AdSetsTab campaign={c} st={structure} onSynced={() => (refetch(), void structure.refetch())} />}
        {tab === "ads" && <AdsTab campaign={c} st={structure} adSetFilter={searchParams.get("adset")} onSynced={() => (refetch(), void structure.refetch())} />}
        {tab === "log" && <HistoryTab campaign={c} onChanged={refetch} />}
        {tab === "settings" && <SettingsTab key={c.updatedAt} campaign={c} onSaved={refetch} onDelete={() => void remove()} />}
      </PageBody>

      <DuplicateDialog campaign={c} open={duplicateOpen} onClose={() => setDuplicateOpen(false)} />
    </>
  );
}
