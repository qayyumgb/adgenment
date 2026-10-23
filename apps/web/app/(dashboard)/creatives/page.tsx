"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownUp, LayoutGrid, Grid3x3, Sparkles, Upload } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useAccess } from "@/components/app/team/access";
import type { Creative, CreativeBoardItem } from "@/lib/api";
import { cn } from "@/lib/cn";
import { PageBody, PageHeader } from "@/components/app/shell/PageHeader";
import { useClientScope } from "@/components/app/shell/ClientContext";
import { FilterMultiSelect, GridSearch } from "@/components/app/grid";
import { Button, Card, Menu, MenuItem, MenuLabel, Segmented, Skeleton } from "@/components/app/ui";
import { CreativeCard } from "@/components/app/creatives/CreativeCard";
import { CreativeDrawer } from "@/components/app/creatives/CreativeDrawer";
import { EditCreativeDialog } from "@/components/app/creatives/EditCreativeDialog";
import { Studio, type StudioHandle } from "@/components/app/creatives/Studio";
import { UploadDialog } from "@/components/app/creatives/UploadDialog";
import { toView } from "@/components/app/creatives/media";
import { FORMAT_LABEL, SORTS, inTab, sortItems, type SortKey, type StatusTab } from "@/components/app/creatives/board";

/**
 * Creatives (guide §5.4, plan A8): the creative studio, then the library as
 * cards — library creatives and the ads synced from Meta, with real results,
 * delivery status and creative fatigue. Card → drawer with the read and
 * actions. Upload (image / video with Meta transcode / carousel / link) and
 * the copy-variant editor carry over from the old page.
 */

const PREFS_KEY = "advertix.creatives";
type Prefs = { studio: boolean; size: "big" | "small"; sort: SortKey };
const DEFAULT_PREFS: Prefs = { studio: true, size: "big", sort: "spend" };

function usePrefs() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (raw) setPrefs({ ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) });
    } catch {
      /* private mode */
    }
  }, []);
  const update = (patch: Partial<Prefs>) =>
    setPrefs((p) => {
      const next = { ...p, ...patch };
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {
        /* private mode */
      }
      return next;
    });
  return [prefs, update] as const;
}

const TYPE_OPTIONS = (["IMAGE", "VIDEO", "CAROUSEL", "TEXT"] as const).map((t) => ({ value: t, label: FORMAT_LABEL[t] }));
const SOURCE_OPTIONS = [
  { value: "library", label: "Library" },
  { value: "meta", label: "From Meta" },
];

export default function CreativesPage() {
  const { clientId, client, clients, hasMultiple } = useClientScope();
  const board = useApi((c) => c.getCreativeBoard(30, clientId), [clientId], { key: "creative-board" });
  const [prefs, setPrefs] = usePrefs();
  const access = useAccess();
  const canEdit = access.can("edit");
  const [tab, setTab] = useState<StatusTab>("all");
  const [q, setQ] = useState("");
  const [types, setTypes] = useState<string[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [editing, setEditing] = useState<CreativeBoardItem | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const studioRef = useRef<StudioHandle>(null);
  const studioBox = useRef<HTMLDivElement>(null);

  const items = useMemo(() => board.data?.items ?? [], [board.data]);
  const clientName = (id: string | null) => (!clientId && hasMultiple && id ? clients.find((c) => c.id === id)?.name ?? null : null);
  const scopeName = client?.name ?? (hasMultiple ? "All clients" : "Workspace");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter(
      (i) =>
        (!types.length || types.includes(i.format)) &&
        (!sources.length || sources.includes(i.source)) &&
        (!needle || i.name.toLowerCase().includes(needle) || (i.headline ?? "").toLowerCase().includes(needle))
    );
  }, [items, q, types, sources]);
  const counts = useMemo(
    () => ({
      all: filtered.filter((i) => inTab(i, "all")).length,
      live: filtered.filter((i) => inTab(i, "live")).length,
      fatigued: filtered.filter((i) => inTab(i, "fatigued")).length,
      draft: filtered.filter((i) => inTab(i, "draft")).length,
      archived: filtered.filter((i) => inTab(i, "archived")).length,
    }),
    [filtered]
  );
  const shown = useMemo(() => sortItems(filtered.filter((i) => inTab(i, tab)), prefs.sort), [filtered, tab, prefs.sort]);
  const open = items.find((i) => i.key === openKey) ?? null;

  const nAll = items.filter((i) => i.status !== "Archived").length;
  const nFat = items.filter((i) => i.status === "Fatigued").length;
  const nDraft = items.filter((i) => i.status === "Draft").length;
  const filtersOn = Boolean(q || types.length || sources.length || tab !== "all");

  const showStudio = () => {
    setPrefs({ studio: true });
    setTimeout(() => studioBox.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };
  const variantsFrom = (item: CreativeBoardItem) => {
    setOpenKey(null);
    showStudio();
    setTimeout(() => studioRef.current?.seedFrom(item), 80);
  };

  return (
    <>
      <PageHeader
        kicker={`${scopeName} · creative library`}
        title="Creatives"
        summary={board.loading && !board.data ? "Loading…" : `${nAll} asset${nAll === 1 ? "" : "s"} · ${nFat} fatigued · ${nDraft} draft${nDraft === 1 ? "" : "s"}`}
        actions={
          <>
            <Button variant="secondary" icon={<Upload size={16} />} onClick={() => setUploadOpen(true)} disabled={!canEdit} title={canEdit ? undefined : access.why("edit")}>
              Upload
            </Button>
            <Button variant="primary" icon={<Sparkles size={16} />} onClick={showStudio} disabled={!canEdit} title={canEdit ? undefined : access.why("edit")}>
              Creative studio
            </Button>
          </>
        }
      />
      <PageBody className="gap-5">
        {prefs.studio && canEdit && (
          <div ref={studioBox} className="scroll-mt-[150px]">
            <Studio ref={studioRef} board={board.data} clientId={clientId} clientName={client?.name ?? null} onClose={() => setPrefs({ studio: false })} onSaved={() => void board.refetch()} />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2.5">
          <GridSearch value={q} onChange={setQ} placeholder="Filter by name or headline" label="Filter creatives" />
          <Segmented
            label="Status"
            size="sm"
            value={tab}
            onChange={setTab}
            options={[
              { value: "all" as StatusTab, label: "All", count: counts.all },
              { value: "live" as StatusTab, label: "Live", count: counts.live },
              { value: "fatigued" as StatusTab, label: "Fatigued", count: counts.fatigued },
              { value: "draft" as StatusTab, label: "Draft", count: counts.draft },
              ...(counts.archived ? [{ value: "archived" as StatusTab, label: "Archived", count: counts.archived }] : []),
            ]}
          />
          <FilterMultiSelect label="Type" options={TYPE_OPTIONS} value={types} onChange={setTypes} width={200} />
          {items.some((i) => i.source === "meta") && <FilterMultiSelect label="Source" options={SOURCE_OPTIONS} value={sources} onChange={setSources} width={200} />}
          <div className="ml-auto flex items-center gap-2">
            <Menu
              align="end"
              width={220}
              trigger={(p) => (
                <Button {...p} variant="secondary" size="toolbar" icon={<ArrowDownUp size={15} />}>
                  Sort <span className="font-normal text-ink-3">· {SORTS.find((s) => s.value === prefs.sort)?.label}</span>
                </Button>
              )}
            >
              {(close) => (
                <>
                  <MenuLabel>Sort by</MenuLabel>
                  {SORTS.map((s) => (
                    <MenuItem key={s.value} selected={prefs.sort === s.value} onSelect={() => (setPrefs({ sort: s.value }), close())}>
                      {s.label}
                    </MenuItem>
                  ))}
                </>
              )}
            </Menu>
            <Segmented
              label="Card size"
              size="sm"
              value={prefs.size}
              onChange={(v) => setPrefs({ size: v })}
              options={[
                { value: "big" as const, label: <LayoutGrid size={15} aria-label="Large cards" /> },
                { value: "small" as const, label: <Grid3x3 size={15} aria-label="Small cards" /> },
              ]}
            />
          </div>
        </div>

        {board.error ? (
          <Card className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-neg">Couldn’t load creatives: {board.error}</span>
            <Button variant="secondary" size="sm" onClick={() => void board.refetch()}>
              Try again
            </Button>
          </Card>
        ) : board.loading && !board.data ? (
          <div className={cn("grid gap-4", prefs.size === "big" ? "grid-cols-[repeat(auto-fill,minmax(250px,1fr))]" : "grid-cols-[repeat(auto-fill,minmax(180px,1fr))]")}>
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[4/6] rounded-card" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <Card className="flex flex-col items-start gap-2 border-dashed px-6 py-12">
            <span className="text-lg font-semibold">No creatives yet</span>
            <span className="max-w-[560px] text-ink-2">Upload an image, video or carousel, or describe an ad in the studio. Ads synced from Meta show up here too, with their results.</span>
            <div className="mt-2 flex gap-2">
              <Button variant="secondary" icon={<Upload size={16} />} onClick={() => setUploadOpen(true)}>
                Upload
              </Button>
              <Button variant="primary" icon={<Sparkles size={16} />} onClick={showStudio}>
                Open the studio
              </Button>
            </div>
          </Card>
        ) : shown.length === 0 ? (
          <Card className="flex flex-col items-start gap-2 border-dashed px-6 py-12">
            <span className="text-lg font-semibold">No creatives match</span>
            <span className="text-ink-2">Try another status or filter, or generate fresh variants in the studio above.</span>
            {filtersOn && (
              <Button
                variant="secondary"
                size="sm"
                className="mt-2"
                onClick={() => {
                  setQ("");
                  setTypes([]);
                  setSources([]);
                  setTab("all");
                }}
              >
                Clear filters
              </Button>
            )}
          </Card>
        ) : (
          <div className={cn("grid gap-4", prefs.size === "big" ? "grid-cols-[repeat(auto-fill,minmax(250px,1fr))]" : "grid-cols-[repeat(auto-fill,minmax(180px,1fr))]")}>
            {shown.map((i) => (
              <CreativeCard key={i.key} item={i} clientName={clientName(i.clientId)} compact={prefs.size === "small"} onOpen={() => setOpenKey(i.key)} />
            ))}
          </div>
        )}
        {items.length > 0 && <p className="text-xs text-ink-3">Results cover the last 30 days. Ads synced from Meta refresh with each sync.</p>}
      </PageBody>

      <CreativeDrawer
        item={open}
        all={items}
        clientName={open ? clientName(open.clientId) : null}
        onClose={() => setOpenKey(null)}
        onEdit={(i) => setEditing(i)}
        onVariants={variantsFrom}
        onChanged={() => void board.refetch()}
      />
      {editing && editing.creativeId && (
        <EditCreativeDialog
          open
          onClose={() => setEditing(null)}
          creative={toView({ id: editing.creativeId, name: editing.name, type: editing.format === "UNKNOWN" ? "IMAGE" : editing.format, aiGenerated: editing.aiGenerated, content: editing.content, createdAt: editing.createdAt } as Creative)}
          rawContent={editing.content}
          onSaved={() => {
            setEditing(null);
            void board.refetch();
          }}
        />
      )}
      <UploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} onSaved={() => void board.refetch()} clientId={clientId} />
    </>
  );
}
