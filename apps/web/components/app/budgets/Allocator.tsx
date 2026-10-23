"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { SlidersHorizontal } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useApiClient, type AllocationResult, type AllocatorData, type AllocatorPlatform } from "@/lib/api";
import { cn } from "@/lib/cn";
import { fmtMoney } from "@/lib/money";
import { AiNote, Button, Card, Dialog, PlatformBadge, Segmented, Skeleton, type PlatformKey } from "@/components/app/ui";
import { useAccess } from "@/components/app/team/access";
import { currentMix, marginalAt, project, reachable, recommendMix, splitPlatform, valueAt, type Mix } from "./model";

/**
 * Cross-platform allocator (guide §5.6, plan A11): drag each platform's daily
 * budget; projections come from response curves fitted to the client's last
 * 60 days. "Review & apply" previews every campaign's change (each campaign
 * moves by the same %) and sends live Meta changes to Meta, logged with Undo;
 * other platforms are listed to change by hand.
 */

export type AllocatorHandle = { focusClient: (clientId: string, fit?: boolean) => void };

const BAR: Partial<Record<PlatformKey, string>> = { META: "bg-[var(--p-meta)]", GOOGLE: "bg-[var(--p-google)]", TIKTOK: "bg-ink", LINKEDIN: "bg-[var(--p-li)]" };

function ApplyDialog({ data, mix, onClose, onApplied }: { data: AllocatorData; mix: Mix; onClose: () => void; onApplied: () => void }) {
  const api = useApiClient();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AllocationResult | null>(null);
  const money = (n: number) => fmtMoney(n, data.currency);
  const changed = data.platforms.filter((p) => Math.abs((mix[p.platform] ?? p.currentDaily) - p.currentDaily) >= 0.5);
  const rows = changed.flatMap((p) => splitPlatform(p, mix[p.platform]).map((c) => ({ ...c, platform: p.platform, name: c.name })));
  const sendable = rows.filter((r) => !r.blocker && Math.abs(r.to - r.budget) >= 0.01).length;

  const apply = async () => {
    setBusy(true);
    try {
      const r = await api.applyAllocation({ clientId: data.clientId!, targets: Object.fromEntries(changed.map((p) => [p.platform, mix[p.platform]])) });
      setResult(r);
      onApplied();
      if (r.applied && !r.failed) toast.success(`${r.applied} budget${r.applied === 1 ? "" : "s"} changed on Meta`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nothing was changed.");
    } finally {
      setBusy(false);
    }
  };

  const list = result ? result.results : rows.map((r) => ({ campaignId: r.id, name: r.name, platform: r.platform, from: r.budget, to: r.to, status: r.blocker ? ("skipped" as const) : ("pending" as const), reason: r.blocker }));
  return (
    <Dialog
      open
      onClose={() => !busy && onClose()}
      title={result ? "Budgets updated" : "Review budget changes"}
      sub={result ? `${result.applied} changed on Meta · ${result.skipped} to change by hand${result.failed ? ` · ${result.failed} refused` : ""}` : "Each campaign moves by the same % as its platform. Undo is in each campaign’s Change log for 7 days."}
      width={640}
      footer={
        result ? (
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" loading={busy} onClick={() => void apply()} disabled={sendable === 0}>
              {sendable ? `Change ${sendable} on Meta` : "Nothing to send"}
            </Button>
          </>
        )
      }
    >
      <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-line">
        {list.map((r) => (
          <div key={r.campaignId} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-3.5 py-2.5 text-[13px] last:border-b-0">
            <PlatformBadge platform={r.platform as PlatformKey} size={20} />
            <span className="min-w-0 flex-1 truncate font-medium">{r.name}</span>
            <span className="tabular-nums">
              {money(r.from)} → <span className="font-semibold">{money(r.to)}</span>/day
            </span>
            <span
              className={cn(
                "w-full pl-[32px] text-xs",
                r.status === "applied" ? "text-pos" : r.status === "failed" ? "text-neg" : r.status === "skipped" ? "text-warn" : "text-ink-3"
              )}
            >
              {r.status === "applied" ? "Changed on Meta" : r.status === "pending" ? "Will change on Meta" : r.reason}
            </span>
          </div>
        ))}
      </div>
    </Dialog>
  );
}

export const Allocator = forwardRef<AllocatorHandle, { scopeClientId: string | null }>(function Allocator({ scopeClientId }, ref) {
  const access = useAccess();
  const [picked, setPicked] = useState<string | null>(null);
  const q = useApi((c) => c.getAllocator(picked ?? scopeClientId), [picked, scopeClientId], { key: "allocator" });
  const data = q.data;
  const [mix, setMix] = useState<Mix>({});
  const [applyOpen, setApplyOpen] = useState(false);
  const [pendingFit, setPendingFit] = useState(false);

  useEffect(() => setPicked(null), [scopeClientId]);
  useEffect(() => {
    if (!data) return;
    setMix(currentMix(data.platforms));
  }, [data]);
  useImperativeHandle(ref, () => ({
    focusClient: (clientId, fit) => {
      setPicked(clientId);
      setPendingFit(Boolean(fit));
    },
  }));

  const ps = useMemo(() => data?.platforms ?? [], [data]);
  const now = currentMix(ps);
  const totalNow = ps.reduce((a, p) => a + p.currentDaily, 0);
  const rec = useMemo(() => recommendMix(ps, totalNow), [ps, totalNow]);
  const fitTarget = data?.month ? Math.max(0, (data.month.budget - data.month.spent) / Math.max(1, data.month.daysLeft)) : null;

  useEffect(() => {
    if (pendingFit && data && fitTarget !== null) {
      setMix(recommendMix(ps, fitTarget));
      setPendingFit(false);
    }
  }, [pendingFit, data, ps, fitTarget]);

  if (q.loading && !data) return <Skeleton className="h-[380px] rounded-card" />;
  if (q.error || !data) {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-neg">Couldn’t load the allocator: {q.error}</span>
        <Button variant="secondary" size="sm" onClick={() => void q.refetch()}>
          Try again
        </Button>
      </Card>
    );
  }

  const revenue = data.metric === "revenue";
  const money = (n: number) => fmtMoney(n, data.currency, { whole: true });
  const cents = (n: number) => fmtMoney(n, data.currency);
  const fmtValue = (n: number) => (revenue ? money(n) : `${n.toFixed(n < 10 ? 1 : 0)} results`);
  const pNow = project(ps, now);
  const pNew = project(ps, mix);
  const delta = pNew.value - pNow.value;
  const changed = ps.some((p) => Math.abs((mix[p.platform] ?? p.currentDaily) - p.currentDaily) >= 0.5);
  const anyCurve = ps.some((p) => p.curve);
  const r = reachable(ps);
  const clientName = data.clients.find((c) => c.id === data.clientId)?.name ?? "";
  const canEdit = access.can("edit");

  // Why this mix: the platform whose next dollar returns most vs least, in words.
  const fitted = ps.filter((p) => p.curve);
  const ranked = [...fitted].sort((a, b) => marginalAt(b, now[b.platform])! - marginalAt(a, now[a.platform])!);
  const why =
    ranked.length >= 2
      ? `At today’s budgets the next ${money(1)} on ${ranked[0].name} returns ${revenue ? cents(marginalAt(ranked[0], now[ranked[0].platform])!) : `${(marginalAt(ranked[0], now[ranked[0].platform])! * 100).toFixed(1)} results per ${money(100)}`}, against ${revenue ? cents(marginalAt(ranked[ranked.length - 1], now[ranked[ranked.length - 1].platform])!) : `${(marginalAt(ranked[ranked.length - 1], now[ranked[ranked.length - 1].platform])! * 100).toFixed(1)} per ${money(100)}`} on ${ranked[ranked.length - 1].name}. Advertix moves budget toward the better return until the two meet, within limits it trusts.`
      : ranked.length === 1
        ? `Only ${ranked[0].name} has enough history for a curve, so the mix can’t move budget between platforms yet. Use it to see what a higher or lower ${ranked[0].name} budget would likely return.`
        : "No platform has enough daily history to fit a curve yet. Results appear after a couple of weeks of delivery at varying spend.";

  return (
    <Card className="flex flex-col gap-5 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] [background:var(--grad)] text-white">
          <SlidersHorizontal size={18} aria-hidden="true" />
        </span>
        <span className="flex min-w-0 flex-[1_1_260px] flex-col leading-tight">
          <span className="text-base font-semibold">Cross-platform allocator</span>
          <span className="text-[13px] text-ink-2">Drag a platform’s daily budget. Projections use each platform’s response curve from the last {data.windowDays} days.</span>
        </span>
        {data.clients.length > 1 && !scopeClientId && (
          <Segmented label="Client" size="sm" value={data.clientId ?? ""} onChange={(v) => setPicked(v)} options={data.clients.slice(0, 6).map((c) => ({ value: c.id, label: c.name.split(" ")[0] }))} />
        )}
      </div>

      {ps.length === 0 ? (
        <div className="rounded-xl bg-surface-2 p-4 text-sm text-ink-2">{clientName ? `${clientName} has` : "There are"} no active campaigns with a daily budget, so there’s nothing to allocate.</div>
      ) : data.mixedCurrency ? (
        <div className="rounded-xl bg-warn-soft p-4 text-sm text-warn">{clientName}’s ad accounts use different currencies, so their budgets can’t be added up. Split the client by currency to use the allocator.</div>
      ) : (
        <div className="flex flex-wrap items-start gap-5">
          <div className="flex min-w-0 flex-[2_1_520px] flex-col">
            <div className="hidden grid-cols-[150px_minmax(160px,1fr)_84px_104px_96px] gap-4 border-b border-line pb-2 text-xs font-medium text-ink-2 min-[760px]:grid">
              <span>Platform</span>
              <span>Daily budget</span>
              <span className="text-right">Per day</span>
              <span className="text-right">{revenue ? "Next $ returns" : `Results / ${money(100)}`}</span>
              <span className="text-right">{revenue ? "Revenue / day" : "Results / day"}</span>
            </div>
            {ps.map((p) => {
              const v = mix[p.platform] ?? p.currentDaily;
              const m = marginalAt(p, v);
              const total = Object.values(mix).reduce((a, x) => a + x, 0) || 1;
              const span = Math.max(1, p.bounds.max - p.bounds.min);
              return (
                <div key={p.platform} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 border-b border-line py-3.5 last:border-b-0 min-[760px]:grid-cols-[150px_minmax(160px,1fr)_84px_104px_96px]">
                  <span className="flex items-center gap-2.5">
                    <PlatformBadge platform={p.platform as PlatformKey} size={26} />
                    <span className="flex flex-col leading-tight">
                      <span className="font-semibold">{p.name}</span>
                      <span className="text-xs text-ink-3">{Math.round((v / total) * 100)}% of mix</span>
                    </span>
                  </span>
                  <span className="col-span-2 flex flex-col gap-1 min-[760px]:col-span-1">
                    {p.curve ? (
                      <span className="relative">
                        <input
                          type="range"
                          min={p.bounds.min}
                          max={p.bounds.max}
                          step={1}
                          value={v}
                          onChange={(e) => setMix((x) => ({ ...x, [p.platform]: Number(e.target.value) }))}
                          aria-label={`${p.name} daily budget`}
                          className="w-full accent-[rgb(var(--c-brand))]"
                        />
                        <span
                          title={`Advertix: ${money(rec[p.platform])}/day`}
                          className="pointer-events-none absolute top-[-2px] h-[22px] w-[3px] -translate-x-1/2 rounded-full bg-pos"
                          style={{ left: `${((rec[p.platform] - p.bounds.min) / span) * 100}%` }}
                        />
                      </span>
                    ) : (
                      <span className="text-xs text-ink-3">{p.noCurveReason} Kept at today’s budget.</span>
                    )}
                    {p.curve && (
                      <span className="flex justify-between text-[11px] text-ink-3 tabular-nums">
                        <span>{money(p.bounds.min)}</span>
                        <span>Advertix {money(rec[p.platform])}</span>
                        <span>{money(p.bounds.max)}</span>
                      </span>
                    )}
                  </span>
                  <span className="text-right font-semibold tabular-nums max-[759px]:row-start-1 max-[759px]:col-start-2">{money(v)}</span>
                  <span className="hidden text-right tabular-nums min-[760px]:block">
                    {m === null ? (
                      "—"
                    ) : (
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", revenue ? (m >= 3 ? "bg-pos-soft text-pos" : m >= 1.5 ? "bg-surface-3 text-ink-2" : "bg-neg-soft text-neg") : "bg-surface-3 text-ink-2")}>
                        {revenue ? cents(m) : (m * 100).toFixed(1)}
                      </span>
                    )}
                  </span>
                  <span className="hidden text-right tabular-nums min-[760px]:block">{fmtValue(valueAt(p, v))}</span>
                </div>
              );
            })}
            <div className="flex flex-wrap items-center gap-3 pt-3 text-xs text-ink-3">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-[3px] rounded-full bg-pos" />
                Advertix recommendation
              </span>
              <span>{revenue ? "“Next $ returns” is the revenue the next dollar earns at that budget." : "Results per extra spend at that budget."}</span>
              <span className="flex-1" />
              <Button variant="ghost" size="sm" onClick={() => setMix(now)} disabled={!changed}>
                Reset to today
              </Button>
            </div>
          </div>

          <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-3 rounded-[14px] bg-surface-2 p-4">
            <span className="text-xs font-medium text-ink-2">Projected for {clientName}</span>
            <div className="flex flex-col">
              <span className="text-xs text-ink-2">{revenue ? "Revenue per day" : "Results per day"}</span>
              <span className="text-[28px] font-semibold leading-tight tracking-[-0.02em] tabular-nums">{fmtValue(pNew.value)}</span>
              <span className={cn("self-start rounded-full px-2 py-0.5 text-xs font-semibold", Math.abs(delta) < 0.5 ? "bg-surface-3 text-ink-2" : delta > 0 ? "bg-pos-soft text-pos" : "bg-neg-soft text-neg")}>
                {delta >= 0 ? "+" : "−"}
                {fmtValue(Math.abs(delta))} / day vs today
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 tabular-nums">
              <span className="flex flex-col rounded-xl bg-surface px-3 py-2.5">
                <span className="text-xs text-ink-2">Daily budget</span>
                <span className="font-semibold">{money(pNew.budget)}</span>
                <span className={cn("text-[11px]", Math.abs(pNew.budget - pNow.budget) < 0.5 ? "text-ink-3" : "text-warn")}>
                  {Math.abs(pNew.budget - pNow.budget) < 0.5 ? "Same total as today" : `${pNew.budget > pNow.budget ? "+" : "−"}${money(Math.abs(pNew.budget - pNow.budget))} vs today`}
                </span>
              </span>
              <span className="flex flex-col rounded-xl bg-surface px-3 py-2.5">
                <span className="text-xs text-ink-2">{revenue ? "Blended ROAS" : "Cost / result"}</span>
                <span className="font-semibold">{revenue ? (pNew.ratio ? `${pNew.ratio.toFixed(2)}x` : "—") : pNew.value > 0 ? money(pNew.budget / pNew.value) : "—"}</span>
                <span className="text-[11px] text-ink-3">now {revenue ? (pNow.ratio ? `${pNow.ratio.toFixed(2)}x` : "—") : pNow.value > 0 ? money(pNow.budget / pNow.value) : "—"}</span>
              </span>
            </div>
            <div className="flex h-2 overflow-hidden rounded-full bg-surface-3" aria-label="Mix">
              {ps.map((p) => (
                <span key={p.platform} title={p.name} className={BAR[p.platform as PlatformKey] ?? "bg-brand"} style={{ width: `${((mix[p.platform] ?? 0) / Math.max(1, pNew.budget)) * 100}%` }} />
              ))}
            </div>
            <AiNote title="Why this mix">{why}</AiNote>
            <div className="flex flex-col gap-2">
              {anyCurve && (
                <Button variant="soft" onClick={() => setMix(rec)}>
                  Use Advertix mix
                </Button>
              )}
              {fitTarget !== null && anyCurve && (
                <Button variant="ghost" size="sm" onClick={() => setMix(recommendMix(ps, fitTarget))} title={`${money(data.month!.budget - data.month!.spent)} left this month over ${data.month!.daysLeft} days`}>
                  Fit to the monthly budget ({money(fitTarget)}/day{fitTarget > r.max || fitTarget < r.min ? ", limited" : ""})
                </Button>
              )}
              <span title={canEdit ? undefined : access.why("edit")}>
                <Button variant="primary" className="w-full bg-ink text-surface hover:bg-ink/90" onClick={() => setApplyOpen(true)} disabled={!changed || !canEdit}>
                  Review &amp; apply
                </Button>
              </span>
            </div>
            <p className="text-[11px] text-ink-3">
              Curves are estimates from past results{fitted.length ? ` (fit ${fitted.map((p) => `${p.name} ${Math.round((p.fit?.r2 ?? 0) * 100)}%`).join(", ")})` : ""}. Budgets stay within half to double today and no more than {`1.5×`} the highest daily spend seen.
            </p>
          </div>
        </div>
      )}
      {applyOpen && <ApplyDialog data={data} mix={mix} onClose={() => setApplyOpen(false)} onApplied={() => void q.refetch()} />}
    </Card>
  );
});

