"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Check } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useAccess } from "@/components/app/team/access";
import { cn } from "@/lib/cn";
import { Card, Pill, type PillTone } from "@/components/app/ui";
import { ApprovalsCard } from "./ApprovalsCard";
import { SafetyCard } from "./SafetyCard";
import type { SettingsSaver } from "./types";

/**
 * Settings › AI & automation (plan A14, decision 11): how much Advertix does
 * on its own. "Suggest only" is the default; "Auto-apply small changes"
 * (C13) and the safety rules (C14) are chosen per client in the Automation
 * card; Autopilot is coming soon. Approvals (C1) decide which Media buyer
 * changes wait for an owner. Both editable cards share the page's Save
 * changes button.
 */

const TODAY = [
  "Suggestions (in Campaigns, the Overview and Budgets) change nothing until someone clicks Apply, except small budget moves for clients on auto-apply.",
  "Every change is recorded in the change log with who made it, and can be undone for 7 days.",
  "Budget suggestions stay between half and double the current daily budget.",
  "Changes reach Meta directly; Google, TikTok and LinkedIn are read-only for now.",
  "Media buyers' big budget increases, and their changes to “Ask first” clients, wait for an owner (see Approvals).",
  "Auto-apply and safety rules act on their own only for the clients you turn on, and email you each time (see Automation).",
  "Analysts and client viewers can't apply anything.",
];

export function AiTab({ setSaver }: { setSaver: (s: SettingsSaver | null) => void }) {
  // One Save button for both cards: dirty if either is, saves whichever changed.
  const [savers, setSavers] = useState<{ approvals: SettingsSaver | null; safety: SettingsSaver | null }>({ approvals: null, safety: null });
  const approvalsSaver = useCallback((s: SettingsSaver | null) => setSavers((p) => ({ ...p, approvals: s })), []);
  const safetySaver = useCallback((s: SettingsSaver | null) => setSavers((p) => ({ ...p, safety: s })), []);
  useEffect(() => {
    const all = [savers.approvals, savers.safety].filter((s): s is SettingsSaver => s !== null);
    if (!all.length) return setSaver(null);
    const changed = all.filter((s) => s.dirty);
    const blocked = changed.find((s) => s.disabled) ?? all.find((s) => s.disabled);
    setSaver({
      dirty: changed.length > 0,
      disabled: Boolean(blocked),
      reason: blocked?.reason ?? null,
      save: async () => {
        for (const s of changed) await s.save();
      },
    });
  }, [savers, setSaver]);

  // Same cache as the Automation card: how many clients auto-apply.
  const automation = useApi((c) => c.getSafetySettings(), [], { key: "safety-settings" }).data;
  const canEdit = useAccess().can("workspace");
  const autoClients = automation ? automation.clients.filter((c) => c.autoApply && !c.askFirst).length : 0;
  const total = automation?.clients.length ?? 0;
  const eligible = automation ? automation.clients.filter((c) => !c.askFirst).length : 0;
  const paused = automation?.automationPaused ?? false;

  // Picking a level sets auto-apply for every client it can apply to, in the
  // Automation card's form (saved with Save changes). Cleared when the saved
  // settings change.
  const [picked, setPicked] = useState<{ autoApply: boolean; n: number } | null>(null);
  useEffect(() => setPicked(null), [automation]);
  const pick = (autoApply: boolean) => {
    if (!canEdit || !automation) return;
    if (autoApply && eligible === 0) {
      toast.error(total ? "Every client is “Ask first”, so nothing can apply on its own. Turn “Ask first” off in Approvals first." : "Add a client first.");
      return;
    }
    setPicked((p) => ({ autoApply, n: (p?.n ?? 0) + 1 }));
    document.getElementById("automation")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const autoOn = picked ? picked.autoApply : autoClients > 0 && !paused;
  const levels: { id: string; name: string; desc: string; on: boolean; onPick?: () => void; pill: { tone: PillTone; label: string } }[] = [
    {
      id: "suggest",
      name: "Suggest only",
      desc: "Advertix recommends; every change waits for a person to click Apply.",
      on: picked ? !picked.autoApply || eligible < total : total === 0 || autoClients < total || paused,
      onPick: () => pick(false),
      pill: picked
        ? { tone: "brand", label: !picked.autoApply ? "Unsaved · every client" : eligible < total ? `Unsaved · ${total - eligible} “Ask first”` : "Unsaved · none" }
        : { tone: "pos", label: autoClients === 0 || paused ? "Every client" : `${total - autoClients} of ${total} clients` },
    },
    {
      id: "small",
      name: "Auto-apply small changes",
      desc: "Budget suggestions within your limit apply on their own, one per campaign per day. Everything else still asks.",
      on: autoOn,
      onPick: () => pick(true),
      pill: picked
        ? picked.autoApply
          ? { tone: "brand", label: `Unsaved · ${eligible} client${eligible === 1 ? "" : "s"}` }
          : { tone: "brand", label: "Unsaved · off" }
        : paused && autoClients
          ? { tone: "warn", label: "Paused" }
          : autoClients
            ? { tone: "pos", label: `${autoClients} client${autoClients === 1 ? "" : "s"}` }
            : { tone: "neutral", label: "Off" },
    },
    { id: "auto", name: "Autopilot", desc: "Advertix manages budgets, bids and creative rotation within your guardrails, and sends a daily summary.", on: false, pill: { tone: "neutral", label: "Coming soon" } },
  ];

  return (
    <>
      <Card padded={false} className="flex flex-col gap-[18px] p-[22px]">
        <div className="flex flex-col gap-0.5">
          <span className="text-base font-semibold">How much should Advertix do on its own?</span>
          <span className="text-[13px] text-ink-2">
            Pick one for every client, or choose per client in{" "}
            <a href="#automation" className="font-medium text-brand no-underline hover:text-brand-hover">
              Automation
            </a>{" "}
            below. Every change is logged and can be undone for 7 days.
          </span>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3" role="radiogroup" aria-label="How much Advertix does on its own">
          {levels.map((l) => (
            <button
              key={l.id}
              type="button"
              role="radio"
              aria-checked={l.on}
              disabled={!l.onPick || !canEdit}
              onClick={l.onPick}
              title={!canEdit && l.onPick ? "Only owners can change this." : undefined}
              className={cn(
                "flex flex-col gap-1.5 rounded-[14px] p-[18px] text-left transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-soft disabled:cursor-not-allowed",
                l.on ? "border-[1.5px] border-brand bg-brand-soft" : "border border-line bg-surface enabled:hover:border-line-2",
                l.id === "auto" && "opacity-70"
              )}
            >
              <span className="flex w-full items-center gap-2">
                <span className={cn("inline-flex h-4 w-4 flex-none items-center justify-center rounded-full border-[1.5px]", l.on ? "border-brand bg-brand text-white" : "border-line-2")} aria-hidden="true">
                  {l.on && <Check size={10} strokeWidth={4} />}
                </span>
                <span className="font-semibold">{l.name}</span>
                <Pill tone={l.pill.tone} className="ml-auto">
                  {l.pill.label}
                </Pill>
              </span>
              <span className="text-[13px] text-ink-2">{l.desc}</span>
            </button>
          ))}
        </div>
      </Card>

      <ApprovalsCard setSaver={approvalsSaver} />

      <SafetyCard setSaver={safetySaver} picked={picked} />

      <Card padded={false} className="flex flex-col gap-3 p-[22px]">
        <span className="text-base font-semibold">What Advertix does today</span>
        <ul className="flex flex-col gap-2">
          {TODAY.map((t) => (
            <li key={t} className="flex gap-2.5 text-sm text-ink-2">
              <Check size={16} className="mt-0.5 flex-none text-pos" aria-hidden="true" />
              {t}
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
