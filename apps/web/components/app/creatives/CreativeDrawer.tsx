"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Archive, ArchiveRestore, Download, ExternalLink, MoreHorizontal, Pencil, Sparkles, Trash2 } from "lucide-react";
import { useApiClient, type CreativeBoardItem } from "@/lib/api";
import { fmtMoney } from "@/lib/money";
import { AiNote, Button, ButtonLink, Drawer, IconButton, Menu, MenuItem, MenuSeparator, Pill, PlatformBadge, Toggle, type PlatformKey } from "@/components/app/ui";
import { VideoThumbnailPlayer } from "@/components/app/creatives/VideoThumbnailPlayer";
import { CreativeArt } from "./CreativeCard";
import { useAccess } from "@/components/app/team/access";
import { STATUS_TONE, creativeRead, ctrOf, formatLine, roasOf } from "./board";

const errorText = (err: unknown) => (err instanceof Error && err.message ? err.message : "That didn't work. Try again.");

/**
 * Creative detail (guide §5.4 drawer): preview, copy, results, the Advertix
 * read and actions. Library creatives: Create variants, Edit, Download,
 * Archive / Restore, Delete. Synced Meta ads: Create variants, pause /
 * resume on Meta, open the campaign.
 */
export function CreativeDrawer({
  item,
  all,
  clientName,
  onClose,
  onEdit,
  onVariants,
  onChanged,
}: {
  item: CreativeBoardItem | null;
  all: CreativeBoardItem[];
  clientName: string | null;
  onClose: () => void;
  onEdit: (item: CreativeBoardItem) => void;
  onVariants: (item: CreativeBoardItem) => void;
  onChanged: () => void;
}) {
  const api = useApiClient();
  const [busy, setBusy] = useState(false);
  const canEdit = useAccess().can("edit");
  if (!item) return null;
  const r = roasOf(item);
  const c = ctrOf(item);
  // Read-only roles (B6) see everything but get no edit actions.
  const library = item.source === "library" && canEdit;

  const run = async (fn: () => Promise<unknown>, done: string, close = false) => {
    setBusy(true);
    try {
      await fn();
      toast.success(done);
      onChanged();
      if (close) onClose();
    } catch (err) {
      toast.error(errorText(err), { duration: 6000 });
    } finally {
      setBusy(false);
    }
  };
  const archive = (to: "ARCHIVED" | "DRAFT") =>
    run(() => api.updateCreative(item.creativeId!, { status: to }), to === "ARCHIVED" ? "Archived" : "Restored to the library", true);
  const remove = () => {
    if (!window.confirm(`Delete “${item.name}”? It's removed from the library. Ads already running on Meta aren't affected.`)) return;
    void run(() => api.deleteCreative(item.creativeId!), "Creative deleted", true);
  };
  const toggleAd = () =>
    run(
      () => api.setAdStatus(item.campaignId!, item.adId!, item.switchOn ? "PAUSED" : "ACTIVE"),
      item.switchOn ? `Paused “${item.name}” on Meta` : `Resumed “${item.name}” on Meta`
    );

  return (
    <Drawer
      open
      onClose={onClose}
      width={460}
      title={
        <span className="flex min-w-0 items-center gap-2.5">
          {(item.source === "meta" || item.campaignId) && <PlatformBadge platform={item.platform as PlatformKey} size={26} />}
          <span className="truncate">{item.name}</span>
        </span>
      }
      sub={[clientName, item.source === "meta" ? "From Meta" : null, formatLine(item), item.campaignName].filter(Boolean).join(" · ")}
      actions={
        library ? (
          <Menu
            align="end"
            width={200}
            trigger={(p) => (
              <IconButton {...p} label="More actions" size={32}>
                <MoreHorizontal size={17} />
              </IconButton>
            )}
          >
            {(close) => (
              <>
                {item.status === "Archived" ? (
                  <MenuItem icon={<ArchiveRestore size={15} />} onSelect={() => (close(), void archive("DRAFT"))}>
                    Restore
                  </MenuItem>
                ) : (
                  <MenuItem icon={<Archive size={15} />} onSelect={() => (close(), void archive("ARCHIVED"))}>
                    Archive
                  </MenuItem>
                )}
                <MenuSeparator />
                <MenuItem icon={<Trash2 size={15} />} onSelect={() => (close(), remove())}>
                  <span className="text-neg">Delete</span>
                </MenuItem>
              </>
            )}
          </Menu>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-[18px]">
        <div className="relative">
          {item.videoId ? (
            <VideoThumbnailPlayer thumbnailUrl={item.imageUrl} videoId={item.videoId} alt={item.name} className="aspect-[4/5] max-h-[360px] w-full rounded-[14px]" />
          ) : (
            <CreativeArt item={item} large className="aspect-[4/5] max-h-[360px] w-full rounded-[14px]" />
          )}
          <Pill tone={STATUS_TONE[item.status]} className="absolute left-3.5 top-3.5 shadow-sm">
            {item.status}
          </Pill>
        </div>

        {(item.headline || item.body) && (
          <div className="flex flex-col gap-1 rounded-xl bg-surface-2 px-3.5 py-3">
            {item.headline && <span className="text-[15px] font-semibold [text-wrap:pretty]">{item.headline}</span>}
            {item.body && <span className="text-sm text-ink-2 [text-wrap:pretty]">{item.body}</span>}
            {(item.callToAction || item.linkUrl) && (
              <span className="mt-1 truncate text-xs text-ink-3">{[item.callToAction?.replace(/_/g, " ").toLowerCase(), item.linkUrl].filter(Boolean).join(" · ")}</span>
            )}
          </div>
        )}

        <div className="grid grid-cols-4 gap-2 tabular-nums">
          {[
            ["Spend", item.totals.spend > 0 ? fmtMoney(item.totals.spend, item.currency, { whole: true }) : "—"],
            ["ROAS", r === null ? "—" : `${r.toFixed(2)}x`],
            ["CTR", c === null ? "—" : `${c.toFixed(2)}%`],
            ["Freq.", item.frequency > 0 ? item.frequency.toFixed(1) : "—"],
          ].map(([label, value]) => (
            <span key={label} className="flex min-w-0 flex-col rounded-xl border border-line px-3 py-2.5">
              <span className="text-xs text-ink-2">{label}</span>
              <span className={label === "CTR" && item.fatigue.level === "fatigued" && item.fatigue.reason?.startsWith("CTR") ? "text-base font-semibold text-neg" : "text-base font-semibold"}>{value}</span>
            </span>
          ))}
        </div>
        {item.totals.spend > 0 && <span className="-mt-2.5 text-xs text-ink-3">Last 30 days{item.adCount > 1 ? ` across ${item.adCount} ads` : ""}.</span>}

        <AiNote>{creativeRead(item, all)}</AiNote>

        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Button variant="primary" icon={<Sparkles size={16} />} onClick={() => onVariants(item)}>
              Create variants
            </Button>
          )}
          {library && (
            <Button variant="secondary" icon={<Pencil size={16} />} onClick={() => onEdit(item)} disabled={busy}>
              {item.needsMedia ? `Add ${item.format === "VIDEO" ? "video" : "image"}` : "Edit"}
            </Button>
          )}
          {item.source === "library" && item.imageUrl && !item.imageUrl.startsWith("data:") && (
            <ButtonLink href={item.imageUrl} target="_blank" rel="noopener noreferrer" variant="secondary" icon={<Download size={16} />}>
              Download
            </ButtonLink>
          )}
          {item.campaignId && (
            <ButtonLink href={`/campaigns/${item.campaignId}${item.source === "meta" ? "?tab=ads" : ""}`} variant="secondary" icon={<ExternalLink size={16} />}>
              Open campaign
            </ButtonLink>
          )}
        </div>

        {item.source === "meta" && item.switchOn !== null && canEdit && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-3 text-sm">
            <span className="flex flex-col leading-tight">
              <span className="font-medium">{item.switchOn ? "On" : "Off"} on Meta</span>
              <span className="text-xs text-ink-2">{item.statusBlocker ?? "Pausing here pauses this ad on Meta. Undo is in the campaign's Change log."}</span>
            </span>
            <Toggle checked={item.switchOn} onChange={() => void toggleAd()} label={`${item.switchOn ? "Pause" : "Resume"} ${item.name}`} disabled={busy || Boolean(item.statusBlocker)} />
          </div>
        )}
      </div>
    </Drawer>
  );
}
