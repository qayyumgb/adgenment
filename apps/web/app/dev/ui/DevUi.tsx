"use client";

import { useState, type ReactNode } from "react";
import { ArrowUpDown, Download, Moon, Plus, Sun } from "lucide-react";
import { ThemeProvider, useTheme } from "@/components/app/theme/ThemeProvider";
import {
  AiMark,
  AiNote,
  AiSuggestion,
  Button,
  Card,
  CardHeader,
  Checkbox,
  DeltaPill,
  Dialog,
  Drawer,
  EmptyState,
  IconButton,
  KpiCard,
  Menu,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  Pill,
  PlatformBadge,
  Segmented,
  Skeleton,
  StatusPill,
  Toggle,
  type SuggestionState,
} from "@/components/app/ui";

const SPARK = [12, 14, 11, 16, 15, 18, 17, 21, 19, 22, 20, 24, 23, 27];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="m-0 text-[11px] font-semibold uppercase tracking-[.06em] text-ink-3">{title}</h2>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </section>
  );
}

function Kit() {
  const { resolved, toggle } = useTheme();
  const [range, setRange] = useState<7 | 14 | 30>(30);
  const [status, setStatus] = useState("All");
  const [on, setOn] = useState(true);
  const [checked, setChecked] = useState(true);
  const [sort, setSort] = useState("Spend");
  const [dialog, setDialog] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [sug, setSug] = useState<SuggestionState>("open");
  const [busy, setBusy] = useState(false);

  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-surface px-6">
        <h1 className="m-0 flex-1 text-lg font-semibold">UI kit · {resolved}</h1>
        <IconButton label="Toggle theme" onClick={toggle}>
          {resolved === "dark" ? <Moon size={18} /> : <Sun size={18} />}
        </IconButton>
      </header>

      <main className="mx-auto flex max-w-[1200px] flex-col gap-8 px-[clamp(16px,4vw,32px)] py-8">
        <Section title="Buttons">
          <Button variant="primary" icon={<Plus size={16} strokeWidth={2.5} />}>
            New campaign
          </Button>
          <Button variant="secondary">Export report</Button>
          <Button variant="secondary" size="toolbar" icon={<ArrowUpDown size={15} />}>
            Sort · Spend
          </Button>
          <Button variant="soft">Shift budget</Button>
          <Button variant="ghost">Not now</Button>
          <Button variant="primary" loading>
            Saving
          </Button>
          <Button variant="secondary" disabled title="Available when Google publishing ships">
            Disabled
          </Button>
          <IconButton label="Download">
            <Download size={18} />
          </IconButton>
        </Section>

        <Section title="Controls">
          <Segmented
            label="Range"
            value={range}
            onChange={setRange}
            options={[
              { value: 7, label: "7D" },
              { value: 14, label: "14D" },
              { value: 30, label: "30D" },
            ]}
          />
          <Segmented
            label="Status"
            value={status}
            onChange={setStatus}
            options={[
              { value: "All", label: "All", count: 15 },
              { value: "Active", label: "Active", count: 12 },
              { value: "Paused", label: "Paused", count: 1 },
              { value: "Draft", label: "Draft", count: 1, disabled: true },
            ]}
          />
          <Toggle checked={on} onChange={setOn} label="Campaign running" />
          <Checkbox checked={checked} onChange={setChecked} label="Wrap long values" />
          <Checkbox checked={false} indeterminate onChange={() => {}} label="Some selected" />
          <Menu
            trigger={(p) => (
              <Button variant="secondary" size="toolbar" {...p} className={p.className}>
                Sort · {sort}
              </Button>
            )}
          >
            {(close) => (
              <>
                <MenuLabel>Sort by</MenuLabel>
                {["Spend", "ROAS", "Conversions", "Campaign name"].map((s) => (
                  <MenuItem
                    key={s}
                    selected={s === sort}
                    onSelect={() => {
                      setSort(s);
                      close();
                    }}
                  >
                    {s}
                  </MenuItem>
                ))}
                <MenuSeparator />
                <MenuItem onSelect={close} hint="⌘R">
                  Reset to default
                </MenuItem>
              </>
            )}
          </Menu>
        </Section>

        <Section title="Pills & badges">
          {["Active", "Learning", "Paused", "Draft", "Fatigued"].map((s) => (
            <StatusPill key={s} status={s} />
          ))}
          <DeltaPill value={12.4} />
          <DeltaPill value={-2.4} higherIsBetter={false} />
          <DeltaPill value={-8.1} />
          <DeltaPill value={0} />
          <Pill tone="brand">Budget shift</Pill>
          {(["META", "GOOGLE", "TIKTOK", "SNAPCHAT", "LINKEDIN"] as const).map((p) => (
            <PlatformBadge key={p} platform={p} />
          ))}
          <PlatformBadge platform="META" withName />
          <AiMark />
        </Section>

        <Section title="KPI cards">
          <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-4">
            <KpiCard label="Spend" value="$184,620" delta={12.4} spark={SPARK} />
            <KpiCard label="Revenue" value="$704,020" delta={18.1} spark={SPARK} />
            <KpiCard label="Cost / conversion" value="$19.62" delta={-2.4} higherIsBetter={false} spark={[...SPARK].reverse()} />
            <KpiCard label="ROAS" value="3.81x" delta={4.9} selected onClick={() => {}} spark={SPARK} />
            <KpiCard label="Loading" value="" delta={0} spark={SPARK} loading />
          </div>
        </Section>

        <div className="grid gap-4 min-[900px]:grid-cols-2">
          <Card>
            <CardHeader icon={<AiMark />} title="Advertix suggests" sub="2 open · reviewed 2 hours ago" />
            <AiSuggestion
              className="mt-3"
              kind="Budget shift"
              client="Fieldhouse Athletics"
              title="Move $250/day from Google Generic Search to TikTok Spark Ads"
              reason="Over the last 7 days TikTok CPA is $14.20 against $26.80 on Generic Search."
              impact="+$3,100 / week"
              actionLabel="Shift budget"
              doneLabel="Budget shifted"
              state={sug}
              busy={busy}
              onApply={() => {
                setBusy(true);
                setTimeout(() => {
                  setBusy(false);
                  setSug("applied");
                }, 700);
              }}
              onSnooze={() => setSug("snoozed")}
              onUndo={() => setSug("open")}
            />
            <AiSuggestion
              kind="Creative fatigue"
              client="Lumen Skincare"
              title="Rotate out “UGC v3 — Morning routine”"
              reason="Frequency reached 4.8 and CTR fell 38% in five days."
              impact="Protects $460/day"
              actionLabel="Review variants"
              mode="review"
              onReview={() => setDrawer(true)}
              onSnooze={() => {}}
            />
          </Card>
          <div className="flex flex-col gap-4">
            <AiNote>Fieldhouse first: it has the most money at stake this week, and the TikTok move pays back within five days.</AiNote>
            <Card className="flex flex-col gap-3">
              <CardHeader title="Loading state" sub="Skeleton shimmer" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-24 w-full" />
            </Card>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setDialog(true)}>
                Open dialog
              </Button>
              <Button variant="secondary" onClick={() => setDrawer(true)}>
                Open drawer
              </Button>
            </div>
          </div>
        </div>

        <Section title="Empty states">
          <EmptyState
            className="w-full min-[700px]:w-[calc(50%-6px)]"
            title="No campaigns match these filters"
            body="Try another status or platform, or clear the filters."
            action={<Button variant="secondary">Clear filters</Button>}
          />
          <EmptyState
            dashed
            className="w-full min-[700px]:w-[calc(50%-6px)]"
            title="Your plan will appear here"
            body="Campaigns, budget split, timeline and a revenue forecast."
          />
        </Section>
      </main>

      <Dialog
        open={dialog}
        onClose={() => setDialog(false)}
        title="Duplicate “Glow Serum — Q4 Prospecting”"
        sub="3 ad sets and 4 ads are copied"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => setDialog(false)}>
              Duplicate
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4 text-sm">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-ink-2">New name</span>
            <input
              defaultValue="Glow Serum — Q4 Prospecting (copy)"
              className="h-10 rounded-ctl border border-line-2 bg-surface px-3 text-ink outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-soft"
            />
          </label>
          <Toggle checked label="Create paused" onChange={() => {}} />
        </div>
      </Dialog>

      <Drawer open={drawer} onClose={() => setDrawer(false)} title="UGC v3 — Morning routine" sub="Lumen Skincare · Meta · Video 9:16">
        <div className="flex flex-col gap-4">
          <div className="aspect-[4/5] w-full rounded-xl bg-[repeating-linear-gradient(45deg,var(--surface-2)_0_10px,var(--surface-3)_10px_20px)]" />
          <AiNote>Frequency 4.8 and falling CTR: time to rotate. Two variants reuse the founder hook.</AiNote>
        </div>
      </Drawer>
    </div>
  );
}

export function DevUi() {
  return (
    <ThemeProvider>
      <Kit />
    </ThemeProvider>
  );
}
