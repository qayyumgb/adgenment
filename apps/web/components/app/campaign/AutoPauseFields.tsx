"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { AutoPause, Blackout, Campaign, KeyDate } from "@/lib/api";
import { cn } from "@/lib/cn";
import { Button } from "@/components/app/ui";

/**
 * Auto-pause (plan C6): pause a Meta campaign when it reaches a spend cap, on
 * blackout dates (back on the day after), or while tracking is down. Used by
 * the New campaign wizard and the campaign's Settings tab; the API acts on it
 * hourly with the safety rules.
 */

export type AutoPauseForm = { capOn: boolean; capInput: string; blackoutsOn: boolean; blackouts: Blackout[]; tracking: boolean };

export const emptyAutoPause = (): AutoPauseForm => ({ capOn: false, capInput: "", blackoutsOn: false, blackouts: [], tracking: false });

export function autoPauseFromCampaign(c: Pick<Campaign, "spendCap" | "blackouts" | "pauseOnTrackingLoss">): AutoPauseForm {
  const cap = c.spendCap != null ? Number(c.spendCap) : null;
  const blackouts = c.blackouts ?? [];
  return { capOn: cap != null, capInput: cap != null ? String(cap) : "", blackoutsOn: blackouts.length > 0, blackouts, tracking: !!c.pauseOnTrackingLoss };
}

export function autoPauseCheck(f: AutoPauseForm) {
  const n = Number(f.capInput);
  const cap = f.capOn ? (f.capInput.trim() === "" ? "Enter the most it should spend." : !Number.isFinite(n) || n <= 0 ? "The cap has to be above zero." : null) : null;
  return { cap, ok: !cap };
}

export function toAutoPause(f: AutoPauseForm): AutoPause {
  return { spendCap: f.capOn && Number(f.capInput) > 0 ? Number(f.capInput) : null, blackouts: f.blackoutsOn ? f.blackouts : [], pauseOnTrackingLoss: f.tracking };
}

export const isAutoPauseOn = (f: AutoPauseForm) => (f.capOn && Number(f.capInput) > 0) || (f.blackoutsOn && f.blackouts.length > 0) || f.tracking;

const dm = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
export const blackoutLabel = (b: Blackout) => `${b.label ? `${b.label} · ` : ""}${dm(b.from)}${b.to !== b.from ? ` – ${dm(b.to)}` : ""}`;

/** "Spend cap $500 · 2 blackouts · tracking" (review rows, settings summary). */
export function autoPauseSummary(f: AutoPauseForm, fmtCap: (n: number) => string) {
  const parts: string[] = [];
  if (f.capOn && Number(f.capInput) > 0) parts.push(`at ${fmtCap(Number(f.capInput))} spent`);
  if (f.blackoutsOn && f.blackouts.length) parts.push(f.blackouts.length === 1 ? `on ${blackoutLabel(f.blackouts[0])}` : `on ${f.blackouts.length} blackout periods`);
  if (f.tracking) parts.push("if tracking stops");
  return parts.length ? `Pauses ${parts.join(", ")}` : "Off";
}

const input =
  "h-10 w-full rounded-ctl border border-line-2 bg-surface px-3 text-sm text-ink outline-none transition-colors focus:border-brand focus:ring-[3px] focus:ring-brand-soft disabled:opacity-60";

function Chip({ on, onClick, disabled, children }: { on: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-8 whitespace-nowrap rounded-full border px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-soft disabled:cursor-not-allowed disabled:opacity-60",
        on ? "border-brand bg-brand-soft text-brand" : "border-line-2 bg-surface text-ink-2 hover:bg-surface-2"
      )}
    >
      {children}
    </button>
  );
}

export function AutoPauseFields({
  value: f,
  onChange,
  currencySymbol,
  trackingRelevant,
  trackingCoveredBy,
  keyDates = [],
  minDate,
  maxDate,
  disabled,
}: {
  value: AutoPauseForm;
  onChange: (f: AutoPauseForm) => void;
  currencySymbol: string;
  /** Leads / Sales: campaigns that need the pixel. */
  trackingRelevant: boolean;
  /** The client's own safety rule already covers its conversion campaigns. */
  trackingCoveredBy?: string | null;
  /** Suggestions while the campaign runs (from the calendar). */
  keyDates?: KeyDate[];
  minDate?: string;
  maxDate?: string;
  disabled?: boolean;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [label, setLabel] = useState("");
  const set = (p: Partial<AutoPauseForm>) => onChange({ ...f, ...p });
  const check = autoPauseCheck(f);
  const addBlackout = (b: Blackout) => {
    const next = [...f.blackouts.filter((x) => !(x.from === b.from && x.to === b.to)), b].sort((a, c) => a.from.localeCompare(c.from));
    set({ blackouts: next, blackoutsOn: true });
  };
  const pendingError = from && to && to < from ? "The end date is before the start." : null;
  const suggestions = keyDates.filter((k) => !f.blackouts.some((b) => b.from <= k.date && k.date <= b.to)).slice(0, 6);
  const covered = trackingRelevant && !!trackingCoveredBy;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Pause automatically when">
        <Chip on={f.capOn} disabled={disabled} onClick={() => set({ capOn: !f.capOn })}>
          Spend reaches a cap
        </Chip>
        <Chip on={f.blackoutsOn} disabled={disabled} onClick={() => set({ blackoutsOn: !f.blackoutsOn })}>
          Blackout dates
        </Chip>
        <Chip on={f.tracking || covered} disabled={disabled || covered} onClick={() => set({ tracking: !f.tracking })}>
          Tracking stops
        </Chip>
      </div>

      {f.capOn && (
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Pause once it has spent
          <span className="relative max-w-[260px]">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-3">{currencySymbol}</span>
            <input
              type="number"
              inputMode="decimal"
              min={1}
              value={f.capInput}
              disabled={disabled}
              onChange={(e) => set({ capInput: e.target.value })}
              placeholder="e.g. 1000"
              aria-invalid={!!check.cap}
              className={cn(input, "pl-12 tabular-nums", check.cap && f.capInput.trim() && "border-neg")}
            />
          </span>
          {check.cap && f.capInput.trim() ? (
            <span className="text-xs font-medium text-neg">{check.cap}</span>
          ) : (
            <span className="text-xs font-normal text-ink-2">In total, since it started. Advertix checks every hour, so it can go a little over. Once it&apos;s paused, raise the cap and turn it back on yourself.</span>
          )}
        </label>
      )}

      {f.blackoutsOn && (
        <div className="flex flex-col gap-2.5">
          <span className="text-sm font-medium">Stay paused on these days</span>
          {f.blackouts.length > 0 ? (
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {f.blackouts.map((b) => (
                <li key={`${b.from}-${b.to}`} className="flex items-center gap-1 rounded-full bg-surface-2 py-1 pl-3 pr-1 text-[13px]">
                  {blackoutLabel(b)}
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => set({ blackouts: f.blackouts.filter((x) => x !== b) })}
                    aria-label={`Remove ${blackoutLabel(b)}`}
                    className="flex h-6 w-6 items-center justify-center rounded-full text-ink-3 hover:bg-surface-3 hover:text-ink"
                  >
                    <X size={13} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-xs text-ink-2">No days yet. Add a holiday below or pick your own dates.</span>
          )}
          {suggestions.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-ink-3">While it runs:</span>
              {suggestions.map((k) => (
                <button
                  key={k.date + k.name}
                  type="button"
                  disabled={disabled}
                  onClick={() => addBlackout({ from: k.date, to: k.date, label: k.name })}
                  className="inline-flex h-7 items-center gap-1 rounded-full border border-dashed border-line-2 px-2.5 text-xs font-medium text-ink-2 hover:border-brand hover:text-brand"
                >
                  <Plus size={12} aria-hidden="true" /> {k.name} · {dm(k.date)}
                  {k.approx ? " (approx.)" : ""}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs font-medium text-ink-2">
              From
              <input type="date" value={from} min={minDate} max={maxDate} disabled={disabled} onChange={(e) => (setFrom(e.target.value), !to || to < e.target.value ? setTo(e.target.value) : null)} className={cn(input, "h-9 w-[150px]")} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-ink-2">
              To
              <input type="date" value={to} min={from || minDate} max={maxDate} disabled={disabled} onChange={(e) => setTo(e.target.value)} className={cn(input, "h-9 w-[150px]")} />
            </label>
            <label className="flex min-w-[140px] flex-1 flex-col gap-1 text-xs font-medium text-ink-2">
              Name (optional)
              <input value={label} maxLength={60} disabled={disabled} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Store closed" className={cn(input, "h-9")} />
            </label>
            <Button
              variant="secondary"
              size="sm"
              disabled={disabled || !from || !to || !!pendingError || f.blackouts.length >= 20}
              onClick={() => {
                addBlackout({ from, to, ...(label.trim() ? { label: label.trim() } : {}) });
                setFrom("");
                setTo("");
                setLabel("");
              }}
            >
              Add
            </Button>
          </div>
          <span className={cn("text-xs", pendingError ? "font-medium text-neg" : "text-ink-2")}>
            {pendingError ?? "Days in your workspace's time zone. It turns back on the day after, unless someone changed it meanwhile."}
          </span>
        </div>
      )}

      {(f.tracking || covered) && (
        <p className="m-0 rounded-ctl bg-surface-2 px-3.5 py-2.5 text-[13px] text-ink-2">
          {covered
            ? `Already on: ${trackingCoveredBy}'s safety rule pauses its conversion campaigns when the pixel stops (Settings › AI & automation).`
            : "Pauses while the Meta Pixel on this ad account has had no events for 24 hours, and turns it back on when it fires again."}
          {!trackingRelevant && !covered && " Most useful for Leads and Sales campaigns, which need the pixel to learn."}
        </p>
      )}
    </div>
  );
}
