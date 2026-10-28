"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import type { Flight, FlightCalendar, KeyDate } from "@/lib/api";
import { fmtMoney } from "@/lib/money";
import { PageBody, PageHeader } from "@/components/app/shell/PageHeader";
import { useClientScope } from "@/components/app/shell/ClientContext";
import {
  Button,
  ButtonLink,
  Card,
  Checkbox,
  EmptyState,
  IconButton,
  Menu,
  MenuLabel,
  MenuSeparator,
  Pill,
  PLATFORM_META,
  Segmented,
  Skeleton,
  type PlatformKey,
} from "@/components/app/ui";
import { FlightTimeline, PHASE, PhaseLegend, type ClientRow } from "@/components/app/calendar/FlightTimeline";
import { FlightAgenda } from "@/components/app/calendar/FlightAgenda";
import { ZOOMS, addDays, defaultStart, flightDates, fmtDay, fmtRange, objectiveLabel, ymd, type Zoom } from "@/components/app/calendar/dates";

/**
 * Flight calendar (plan C5): every client's campaigns on one timeline, the
 * overlaps worth a look, and the key dates (Black Friday, Eid, Christmas…)
 * around them. Follows the client switcher; read-only for everyone.
 */

type View = "timeline" | "agenda";
type Group = KeyDate["group"];
const GROUPS: { id: Group; label: string; hint: string }[] = [
  { id: "retail", label: "Retail", hint: "Black Friday, Cyber Monday, Christmas" },
  { id: "seasonal", label: "Seasonal", hint: "Valentine's, Mother's Day, Halloween" },
  { id: "cultural", label: "Cultural", hint: "Eid, Diwali, Lunar New Year" },
];

/** Per-viewer settings (zoom, view, key dates). Storage can be blocked: fall back silently. */
function stored<T>(key: string, fallback: T): T {
  try {
    const v = window.localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function store(key: string, v: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

export default function CalendarPage() {
  const { clientId, client, hasMultiple, scoped } = useClientScope();
  const [zoom, setZoomState] = useState<Zoom>("quarter");
  const [start, setStart] = useState(() => defaultStart("quarter"));
  const [view, setViewState] = useState<View>("timeline");
  const [groups, setGroupsState] = useState<Group[]>(["retail", "seasonal", "cultural"]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Restore the viewer's choices; phones start on the list.
  useEffect(() => {
    const z = stored<Zoom>("adx-cal-zoom", "quarter");
    if (z in ZOOMS && z !== "quarter") {
      setZoomState(z);
      setStart(defaultStart(z));
    }
    setViewState(stored<View>("adx-cal-view", window.matchMedia("(max-width: 719px)").matches ? "agenda" : "timeline"));
    setGroupsState(stored<Group[]>("adx-cal-keydates", ["retail", "seasonal", "cultural"]));
  }, []);
  const setZoom = (z: Zoom) => {
    setZoomState(z);
    setStart(defaultStart(z));
    store("adx-cal-zoom", z);
  };
  const setView = (v: View) => {
    setViewState(v);
    store("adx-cal-view", v);
  };
  const toggleGroup = (g: Group, on: boolean) => {
    const next = on ? [...groups, g] : groups.filter((x) => x !== g);
    setGroupsState(next);
    store("adx-cal-keydates", next);
  };

  const { days, step } = ZOOMS[zoom];
  const end = addDays(start, days - 1);
  const from = ymd(start);
  const to = ymd(end);
  const q = useApi((c) => c.getCalendar(from, to, clientId), [from, to, clientId], { key: "calendar", keepPrevious: true });
  const data = q.data;

  const atToday = from === ymd(defaultStart(zoom));
  const move = (weeks: number) => setStart((s) => addDays(s, 7 * weeks));

  const derived = useMemo(() => (data ? derive(data, start, days) : null), [data, start, days]);
  const keyDates = useMemo(() => (data?.keyDates ?? []).filter((k) => groups.includes(k.group)), [data, groups]);
  const flight = selectedId ? data?.flights.find((f) => f.id === selectedId) ?? null : null;
  const clientName = (id: string | null) => (id ? data?.clients.find((c) => c.id === id)?.name ?? "Client" : "Unassigned accounts");
  const scope = client ? client.name : hasMultiple ? "All clients" : "Your workspace";

  return (
    <>
      <PageHeader
        kicker={`${scope} · flight calendar`}
        title="Calendar"
        summary={derived ? summaryLine(derived) : undefined}
        actions={
          <>
            <Segmented<Zoom> size="sm" label="Zoom" value={zoom} onChange={setZoom} options={(Object.keys(ZOOMS) as Zoom[]).map((z) => ({ value: z, label: ZOOMS[z].label }))} />
            <Segmented<View>
              size="sm"
              label="View"
              value={view}
              onChange={setView}
              options={[
                { value: "timeline", label: "Timeline" },
                { value: "agenda", label: "List" },
              ]}
            />
            <Menu
              align="end"
              width={260}
              trigger={(p) => (
                <Button {...p} variant="secondary" size="sm" icon={<SlidersHorizontal size={14} />}>
                  Key dates
                </Button>
              )}
            >
              {() => (
                <div className="flex flex-col gap-2.5 p-2">
                  <MenuLabel>Show on the calendar</MenuLabel>
                  {GROUPS.map((g) => (
                    <Checkbox
                      key={g.id}
                      checked={groups.includes(g.id)}
                      onChange={(v) => toggleGroup(g.id, v)}
                      label={
                        <span className="flex flex-col">
                          <span className="font-medium">{g.label}</span>
                          <span className="text-xs text-ink-3">{g.hint}</span>
                        </span>
                      }
                    />
                  ))}
                  <MenuSeparator />
                  <span className="px-1 text-xs text-ink-3">Eid and Ramadan dates are approximate: they move with the moon sighting.</span>
                </div>
              )}
            </Menu>
          </>
        }
      />
      <PageBody className="gap-4">
        {derived && derived.checks.length > 0 && <Checks data={data!} checks={derived.checks} clientName={clientName} onSelect={setSelectedId} />}

        <Card padded={false} className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-3 min-[720px]:px-5">
            <div className="flex items-center gap-1">
              <IconButton label="Earlier" size={32} onClick={() => move(-step)}>
                <ChevronLeft size={16} />
              </IconButton>
              <IconButton label="Later" size={32} onClick={() => move(step)}>
                <ChevronRight size={16} />
              </IconButton>
              <Button variant="ghost" size="sm" disabled={atToday} onClick={() => setStart(defaultStart(zoom))}>
                Today
              </Button>
            </div>
            <span className="flex-1 text-base font-semibold tabular-nums" aria-live="polite">
              {fmtRange(start, end)}
            </span>
            {view === "timeline" && <PhaseLegend />}
          </div>

          {q.error && !data ? (
            <EmptyState
              title="The calendar didn't load"
              body={q.error}
              action={
                <Button variant="secondary" size="sm" onClick={() => void q.refetch()}>
                  Try again
                </Button>
              }
            />
          ) : !data || !derived ? (
            <CalendarSkeleton />
          ) : derived.rows.length === 0 ? (
            <EmptyState
              title="Nothing runs in this period"
              body={atToday ? "Campaigns with dates show up here once they're published or synced, and drafts once they have a start date." : "Try another period, or go back to today."}
              action={
                atToday ? (
                  <ButtonLink href={scoped("/campaigns/new")} variant="secondary" size="sm">
                    New campaign
                  </ButtonLink>
                ) : (
                  <Button variant="secondary" size="sm" onClick={() => setStart(defaultStart(zoom))}>
                    Back to today
                  </Button>
                )
              }
            />
          ) : view === "timeline" ? (
            <div className={q.loading ? "opacity-60 transition-opacity" : undefined}>
              <FlightTimeline start={start} days={days} rows={derived.rows} keyDates={keyDates} flagged={derived.flagged} selectedId={selectedId} onSelect={setSelectedId} />
            </div>
          ) : (
            <div className={q.loading ? "opacity-60 transition-opacity" : undefined}>
              <FlightAgenda
                start={start}
                days={days}
                flights={derived.flights}
                keyDates={keyDates}
                clientName={clientName}
                flagged={derived.flagged}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </div>
          )}

          {data && derived && derived.rows.length > 0 && (
            <div className="border-t border-line bg-surface-2 px-4 py-3.5 min-[720px]:px-5">
              {flight ? <Selected f={flight} data={data} clientName={clientName} href={scoped(`/campaigns/${flight.id}`)} onClose={() => setSelectedId(null)} /> : <span className="text-[13px] text-ink-2">Select a campaign to see its dates and budget.</span>}
            </div>
          )}
        </Card>

        {data && (data.undatedDrafts > 0 || data.truncated) && (
          <p className="m-0 text-[13px] text-ink-2">
            {data.undatedDrafts > 0 && (
              <>
                {data.undatedDrafts} draft{data.undatedDrafts === 1 ? " has" : "s have"} no start date, so {data.undatedDrafts === 1 ? "it isn't" : "they aren't"} on the calendar.{" "}
                <Link href={scoped("/campaigns")} className="font-medium text-brand no-underline hover:underline">
                  Open campaigns
                </Link>
                {data.truncated ? " " : ""}
              </>
            )}
            {data.truncated && "Showing the first 1,000 campaigns in this period: pick a client to see the rest."}
          </p>
        )}
      </PageBody>
    </>
  );
}

/* ── Derived data ─────────────────────────────────────────────────────── */

type Check = { kind: "overlap"; o: FlightCalendar["overlaps"][number] } | { kind: "peak"; p: FlightCalendar["peakLaunches"][number] };

function derive(data: FlightCalendar, start: Date, days: number) {
  const t0 = start.getTime();
  const t1 = t0 + days * 86_400_000;
  // The API pads the window a day each side; draw only what's in view.
  const flights = data.flights.filter((f) => new Date(f.start).getTime() < t1 && (!f.end || new Date(f.end).getTime() > t0));
  const ids = new Set(flights.map((f) => f.id));
  const checks: Check[] = [
    ...data.peakLaunches.filter((p) => ids.has(p.campaignId)).map((p) => ({ kind: "peak" as const, p })),
    ...data.overlaps.filter((o) => o.campaignIds.some((id) => ids.has(id))).map((o) => ({ kind: "overlap" as const, o })),
  ];
  const flagged = new Set(checks.flatMap((c) => (c.kind === "peak" ? [c.p.campaignId] : c.o.campaignIds)));
  const byClient = new Map<string | null, Flight[]>();
  for (const f of flights) byClient.set(f.clientId, [...(byClient.get(f.clientId) ?? []), f]);
  const rows: ClientRow[] = [
    ...data.clients.filter((c) => byClient.has(c.id)).map((c) => ({ id: c.id, name: c.name, flights: byClient.get(c.id)! })),
    ...(byClient.has(null) ? [{ id: null, name: "Unassigned accounts", flights: byClient.get(null)! }] : []),
  ];
  const now = Date.now();
  return {
    flights,
    rows,
    checks,
    flagged,
    live: flights.filter((f) => f.phase === "live").length,
    upcoming: flights.filter((f) => new Date(f.start).getTime() > now && f.phase !== "ended").length,
  };
}

function summaryLine(d: ReturnType<typeof derive>) {
  const parts = [`${d.flights.length} campaign${d.flights.length === 1 ? "" : "s"} in view`];
  if (d.live) parts.push(`${d.live} live`);
  if (d.upcoming) parts.push(`${d.upcoming} starting later`);
  if (d.checks.length) parts.push(`${d.checks.length} worth a look`);
  return parts.join(" · ");
}

/* ── Pieces ───────────────────────────────────────────────────────────── */

function CampaignLink({ f, onSelect }: { f: Flight | undefined; onSelect: (id: string) => void }) {
  if (!f) return null;
  return (
    <button type="button" onClick={() => onSelect(f.id)} className="font-semibold text-ink underline decoration-line-2 underline-offset-2 hover:text-brand">
      {f.name}
    </button>
  );
}

function Checks({ data, checks, clientName, onSelect }: { data: FlightCalendar; checks: Check[]; clientName: (id: string | null) => string; onSelect: (id: string) => void }) {
  const byId = (id: string) => data.flights.find((f) => f.id === id);
  return (
    <Card padded={false} className="border-warn/30">
      <div className="flex items-center gap-2 px-5 pb-1 pt-4">
        <AlertTriangle size={16} className="text-warn" aria-hidden="true" />
        <span className="text-base font-semibold">Worth a look</span>
      </div>
      <ul className="m-0 flex list-none flex-col gap-2 p-0 px-5 pb-4 pt-2">
        {checks.map((c, i) => (
          <li key={i} className="rounded-xl bg-warn-soft px-3.5 py-2.5 text-[13px] leading-relaxed text-ink [text-wrap:pretty]">
            {c.kind === "peak" ? (
              <>
                <span className="font-semibold text-warn">Launches into Black Friday week: </span>
                <CampaignLink f={byId(c.p.campaignId)} onSelect={onSelect} /> ({clientName(byId(c.p.campaignId)?.clientId ?? null)}) starts {fmtDay(new Date(byId(c.p.campaignId)!.start))}. Ads cost the most from Thanksgiving to Cyber Monday, and a new campaign spends its first days learning. Starting a week or two earlier lets it settle before the peak.
              </>
            ) : (
              <>
                <span className="font-semibold text-warn">Overlap: </span>
                {c.o.campaignIds.map((id, j) => (
                  <span key={id}>
                    {j > 0 && (j === c.o.campaignIds.length - 1 ? " and " : ", ")}
                    <CampaignLink f={byId(id)} onSelect={onSelect} />
                  </span>
                ))}{" "}
                ({clientName(c.o.clientId)}) are all {objectiveLabel(c.o.objective).toLowerCase()} campaigns on {c.o.adAccountName}, running at the same time {c.o.to ? `from ${fmtDay(new Date(c.o.from))} to ${fmtDay(addDays(new Date(c.o.to), -1))}` : `from ${fmtDay(new Date(c.o.from))}`}.{" "}
                {c.o.sameAudience
                  ? "They use the same saved audience, so they bid against each other for the same people. Consider combining them into one campaign."
                  : `When their audiences overlap they bid against each other, and ${PLATFORM_META[c.o.platform as PlatformKey]?.name ?? "the platform"} delivers mostly one. Check their audiences, or combine them.`}
              </>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Selected({ f, data, clientName, href, onClose }: { f: Flight; data: FlightCalendar; clientName: (id: string | null) => string; href: string; onClose: () => void }) {
  const budget = `${fmtMoney(f.budget, f.currency, { whole: f.budget >= 100 })} ${f.budgetType === "DAILY" ? "a day" : "lifetime"}`;
  const overlapping = data.overlaps.filter((o) => o.campaignIds.includes(f.id)).length;
  const peak = data.peakLaunches.some((p) => p.campaignId === f.id);
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate font-semibold">{f.name}</span>
          <Pill tone={f.phase === "live" ? "pos" : f.phase === "paused" ? "warn" : f.phase === "scheduled" ? "brand" : "neutral"}>{PHASE[f.phase].label}</Pill>
          {(overlapping > 0 || peak) && <Pill tone="warn">Worth a look</Pill>}
        </span>
        <span className="text-[13px] text-ink-2">
          {flightDates(f)}
          {f.startEstimated && " (no start date set: shown from when it was created)"}
          {f.endEstimated && " (ended: shown to its last day with spend)"}
        </span>
        <span className="text-xs text-ink-3">
          {clientName(f.clientId)} · {PLATFORM_META[f.platform as PlatformKey]?.name ?? f.platform} · {f.adAccountName} · {objectiveLabel(f.objective)} · {budget}
        </span>
      </div>
      <div className="flex flex-none gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
        <ButtonLink href={href} variant="secondary" size="sm">
          {f.phase === "draft" ? "Open draft" : "Open campaign"}
        </ButtonLink>
      </div>
    </div>
  );
}

function CalendarSkeleton() {
  return (
    <div className="flex flex-col gap-3 px-5 py-5" aria-busy="true" aria-label="Loading the calendar">
      <Skeleton className="h-10" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="grid grid-cols-[160px_minmax(0,1fr)] gap-3">
          <Skeleton className="h-8" />
          <Skeleton className="h-8" style={{ marginLeft: `${10 + i * 18}%`, width: `${40 - i * 6}%` }} />
        </div>
      ))}
    </div>
  );
}
