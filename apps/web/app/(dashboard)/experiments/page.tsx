"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { ExternalLink, FlaskConical, Lightbulb, Plus, Sparkles, Undo2 } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { ApprovalPendingError, useApiClient, type Experiment, type ExperimentGoal } from "@/lib/api";
import { cn } from "@/lib/cn";
import { fmtMoney } from "@/lib/money";
import { timeAgo } from "@/lib/time";
import { PageBody, PageHeader } from "@/components/app/shell/PageHeader";
import { useClientScope } from "@/components/app/shell/ClientContext";
import { useAccess } from "@/components/app/team/access";
import { Button, ButtonLink, Card, EmptyState, Pill, Segmented, Skeleton, useConfirm } from "@/components/app/ui";
import { NewTestDialog } from "@/components/app/experiments/NewTestDialog";

/**
 * Experiments (plan C9a, the mockup's F3): the Meta A/B tests on your ad
 * accounts, including ones made in Ads Manager, with each version's results,
 * how sure Advertix is about the winner, and when the test will be clear.
 * C9b: start a creative test, end one, Scale the winner (Approvals for media
 * buyers, Undo for 7 days). C9c: a lesson per finished test, shown on top
 * and used by the AI Planner.
 */

const GOAL_LABEL: Record<ExperimentGoal, string> = { purchase: "cost per purchase", click: "cost per click", ctr: "click-through rate" };
const pct = (n: number) => `${Math.round(n * 100)}%`;
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

function metricText(v: Experiment["versions"][number], e: Experiment) {
  if (v.metric == null) return "No results yet";
  if (e.goal === "ctr") return `${(v.metric * 100).toFixed(2)}% CTR`;
  return `${fmtMoney(v.metric, e.adAccount.currency)} per ${e.goal === "purchase" ? "purchase" : "click"}`;
}

/** What Advertix makes of it, in a sentence or two. */
function read(e: Experiment) {
  const lead = e.versions.find((v) => v.leading);
  const word = e.goal === "ctr" ? "higher click-through" : `cheaper per ${e.goal === "purchase" ? "purchase" : "click"}`;
  const by = e.lift != null ? `${Math.round(Math.abs(e.lift) * 100)}% ${word}` : null;
  if (e.status === "scheduled") return `It starts ${e.startTime ? day(e.startTime) : "soon"}. Results appear here from its first day.`;
  if (!lead) return "No results yet. They appear after the next sync.";
  if (e.status === "ended") {
    return e.conclusive ? `${lead.name} won${by ? `: ${by}` : ""}, and Advertix is ${pct(e.confidence)} sure it's better.` : `No clear winner: Advertix is only ${pct(e.confidence)} sure ${lead.name} is better. Treat the versions as equal, or test a bigger difference next time.`;
  }
  if (e.conclusive) {
    return `${lead.name} is ${by ?? "ahead"}, and Advertix is ${pct(e.confidence)} sure it's better.${e.savedByEnding >= 1 ? ` Ending the test now saves about ${fmtMoney(e.savedByEnding, e.adAccount.currency, { whole: true })} on the other version${e.versions.length > 2 ? "s" : ""}.` : ""}`;
  }
  if (e.tooClose) return `Too close to call: ${lead.name} is only slightly ahead (${pct(e.confidence)} sure). If it stays like this, the versions perform about the same.`;
  return `${lead.name} is ahead${by ? ` (${by})` : ""}, ${pct(e.confidence)} sure so far.${e.expectedConclusive ? ` At this pace it's clear around ${day(e.expectedConclusive)}${e.endTime && e.expectedConclusive > e.endTime ? ", after the test ends" : ""}.` : ""}`;
}

type Actions = {
  onGoal: (goal: ExperimentGoal | "auto") => void;
  onEnd: () => void;
  onScale: (winner: number) => void;
  onUndoScale: () => void;
  onLesson: (lesson: string) => void;
  busy: string | null;
  waiting: boolean;
};

function TestCard({ e, canEdit, a }: { e: Experiment; canEdit: boolean; a: Actions }) {
  const [lesson, setLesson] = useState(e.lesson ?? e.suggestedLesson ?? "");
  const winner = e.versions.findIndex((v) => v.leading);
  const canScale = winner >= 0 && (e.status === "ended" || e.conclusive) && !e.scale;
  const split = e.versions.map((v) => Math.round(v.percent)).join("/");
  const sub = [
    e.clientName,
    "Meta",
    split ? `${split} split` : null,
    e.status === "running" ? `day ${e.day}${e.totalDays ? ` of ${e.totalDays}` : ""}` : e.status === "ended" ? `ended ${e.endTime ? day(e.endTime) : ""}` : `starts ${e.startTime ? day(e.startTime) : ""}`,
    `goal: ${GOAL_LABEL[e.goal]}`,
  ].filter(Boolean);
  const words = e.goal === "purchase" ? "purchases" : "clicks";
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-[1_1_280px]">
          <div className="text-base font-semibold">{e.name}</div>
          <div className="text-[13px] text-ink-2">{sub.join(" · ")}</div>
        </div>
        {e.status !== "scheduled" && e.versions.some((v) => v.leading) && (
          <Pill tone={e.conclusive ? "pos" : e.tooClose ? "neutral" : "brand"}>{e.conclusive ? `${pct(e.confidence)} confident` : e.tooClose ? "Too close to call" : `${pct(e.confidence)} so far`}</Pill>
        )}
      </div>

      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {e.versions.map((v) => (
          <li key={v.name} className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 rounded-xl border p-3", v.leading && e.conclusive ? "border-pos/60 bg-pos-soft" : "border-line bg-surface")}>
            <span className="min-w-0">
              <span className="block truncate font-semibold">
                {v.name}
                {v.leading && <span className="font-normal text-ink-2"> · leading</span>}
              </span>
              <span className="block text-xs text-ink-3">
                {Math.round(e.goal === "purchase" ? v.conversions : v.clicks).toLocaleString()} {words} · CTR {v.impressions ? ((v.clicks / v.impressions) * 100).toFixed(2) : "0.00"}% · {fmtMoney(v.spend, e.adAccount.currency, { whole: v.spend >= 100 })} spent
              </span>
            </span>
            <span className="text-right text-sm font-semibold tabular-nums">{metricText(v, e)}</span>
            <span className="col-span-2 flex items-center gap-2">
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
                <span className={cn("block h-full rounded-full", v.leading ? "bg-pos" : "bg-brand-mid")} style={{ width: `${Math.max(2, v.chanceBest * 100)}%` }} />
              </span>
              <span className="w-[112px] text-right text-xs text-ink-2">{pct(v.chanceBest)} chance it&apos;s best</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-1 rounded-xl bg-brand-soft px-4 py-3">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-brand-ink">
          <Sparkles size={13} aria-hidden="true" /> Advertix
        </span>
        <span className="text-[13px] text-ink [text-wrap:pretty]">{read(e)}</span>
      </div>

      {canEdit && (canScale || e.scale || a.waiting || e.status === "running") && (
        <div className="flex flex-wrap items-center gap-2">
          {e.scale?.status === "APPLIED" ? (
            <>
              <span className="text-[13px] font-semibold text-pos">Winner scaled {e.scale.appliedAt ? timeAgo(e.scale.appliedAt) : ""}</span>
              <Button variant="ghost" size="sm" icon={<Undo2 size={14} />} loading={a.busy === "undo"} onClick={a.onUndoScale}>
                Undo
              </Button>
            </>
          ) : a.waiting || e.scale?.status === "OPEN" ? (
            <span className="text-[13px] font-semibold text-brand-ink">⏳ Scale the winner is waiting for an owner in Activity.</span>
          ) : canScale ? (
            <Button variant="primary" size="sm" loading={a.busy === "scale"} onClick={() => a.onScale(winner)}>
              Scale the winner: {e.versions[winner].name}
            </Button>
          ) : null}
          {e.status === "running" && (
            <Button variant={e.conclusive ? "secondary" : "ghost"} size="sm" loading={a.busy === "end"} onClick={a.onEnd}>
              End test
            </Button>
          )}
          {canScale && <span className="text-xs text-ink-3">Pauses the other versions and moves an ad set version&apos;s daily budget to the winner. Undo for 7 days.</span>}
        </div>
      )}

      {e.status === "ended" && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`lesson-${e.id}`} className="flex items-center gap-1.5 text-[13px] font-semibold">
            <Lightbulb size={14} aria-hidden="true" /> What it showed
            {!e.lesson && e.suggestedLesson && <span className="text-xs font-normal text-ink-3">(Advertix&apos;s read: edit and save it)</span>}
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id={`lesson-${e.id}`}
              value={lesson}
              maxLength={300}
              disabled={!canEdit}
              onChange={(x) => setLesson(x.target.value)}
              placeholder="e.g. Founder-led hooks beat UGC for this client"
              className="h-9 min-w-0 flex-[1_1_320px] rounded-ctl border border-line-2 bg-surface px-3 text-[13px] text-ink outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-soft disabled:opacity-60"
            />
            {canEdit && (
              <Button variant="secondary" size="sm" loading={a.busy === "lesson"} disabled={lesson.trim() === (e.lesson ?? "")} onClick={() => a.onLesson(lesson)}>
                Save
              </Button>
            )}
          </div>
          <span className="text-xs text-ink-3">Saved lessons show at the top of this page and help the AI Planner build on what worked.</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Segmented<ExperimentGoal | "auto">
          size="sm"
          label="Judge by"
          value={e.goalChosen ? e.goal : "auto"}
          onChange={(g) => canEdit && a.onGoal(g)}
          options={[
            { value: "auto", label: "Auto", disabled: !canEdit },
            { value: "purchase", label: "Cost / purchase", disabled: !canEdit },
            { value: "click", label: "Cost / click", disabled: !canEdit },
            { value: "ctr", label: "CTR", disabled: !canEdit },
          ]}
        />
        <span className="flex-1" />
        <span className="text-xs text-ink-3">Updated {timeAgo(e.syncedAt)}</span>
        <ButtonLink href={`https://business.facebook.com/adsmanager/manage/campaigns?act=${e.adAccount.accountId}`} target="_blank" rel="noreferrer" variant="secondary" size="sm" icon={<ExternalLink size={14} />}>
          Ads Manager
        </ButtonLink>
      </div>
    </Card>
  );
}

export default function ExperimentsPage() {
  const api = useApiClient();
  const { clientId, client, hasMultiple } = useClientScope();
  const canEdit = useAccess().can("edit");
  const q = useApi((c) => c.getExperiments(clientId), [clientId], { key: "experiments" });
  const lessonsQ = useApi((c) => c.getExperimentLessons(clientId), [clientId], { key: "experiment-lessons" });
  const [busy, setBusy] = useState<{ id: string; what: string } | null>(null);
  const [waiting, setWaiting] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const { confirm, dialog } = useConfirm();
  const lessons = lessonsQ.data?.lessons ?? [];
  const list = q.data?.experiments ?? [];
  const running = list.filter((e) => e.status === "running").length;
  const ended = list.filter((e) => e.status === "ended").length;
  const scope = client ? client.name : hasMultiple ? "All clients" : "Your workspace";

  /** One action at a time per test; refreshes the list (and lessons) after. */
  const run = async (e: Experiment, what: string, fn: () => Promise<unknown>, done?: string) => {
    if (busy) return;
    setBusy({ id: e.id, what });
    try {
      await fn();
      if (done) toast.success(done);
      await Promise.all([q.refetch(), lessonsQ.refetch()]);
    } catch (err) {
      if (err instanceof ApprovalPendingError) setWaiting((w) => [...w, e.id]);
      else toast.error(err instanceof Error ? err.message : "That didn't work");
    } finally {
      setBusy(null);
    }
  };
  const actions = (e: Experiment): Actions => ({
    busy: busy?.id === e.id ? busy.what : null,
    waiting: waiting.includes(e.id),
    onGoal: (g) => void run(e, "goal", () => api.setExperimentGoal(e.id, g)),
    onLesson: (l) => void run(e, "lesson", () => api.setExperimentLesson(e.id, l), "Lesson saved"),
    onEnd: () =>
      void (async () => {
        if (!(await confirm({ title: `End “${e.name}” now?`, body: "Meta stops splitting the audience. The versions keep running until you pause them or scale the winner.", confirmLabel: "End test" }))) return;
        await run(e, "end", () => api.endExperiment(e.id), "Test ended");
      })(),
    onScale: (w) =>
      void (async () => {
        const others = e.versions.filter((_, i) => i !== w).map((v) => v.name).join(" and ");
        if (!(await confirm({ title: `Keep ${e.versions[w].name}?`, body: `Pauses ${others} and, for ad set versions, moves their daily budget to ${e.versions[w].name}. You can undo it for 7 days.`, confirmLabel: "Scale the winner" }))) return;
        await run(e, "scale", async () => {
          const { suggestionId } = await api.scaleExperiment(e.id, w);
          await api.applySuggestion(suggestionId);
        }, `Kept ${e.versions[w].name}`);
      })(),
    onUndoScale: () => void run(e, "undo", () => api.undoSuggestion(e.scale!.suggestionId), "Undone: the other versions are back on"),
  });

  return (
    <>
      <PageHeader
        kicker={`${scope} · experiments`}
        title="Experiments"
        summary={list.length ? [running ? `${running} running` : null, ended ? `${ended} finished` : null].filter(Boolean).join(" · ") || "A/B tests on your ad accounts" : undefined}
        actions={
          canEdit && (
            <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setCreating(true)}>
              New test
            </Button>
          )
        }
      />
      <PageBody className="max-w-[960px] gap-4">
        {lessons.length > 0 && (
          <Card className="flex flex-col gap-2">
            <span className="flex items-center gap-1.5 text-base font-semibold">
              <Lightbulb size={16} className="text-brand" aria-hidden="true" /> What your tests showed
            </span>
            <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-[13px]">
              {lessons.slice(0, 6).map((l) => (
                <li key={l.id}>
                  {l.lesson}
                  {!client && hasMultiple && l.clientName ? <span className="text-ink-3"> · {l.clientName}</span> : null}
                </li>
              ))}
            </ul>
            <span className="text-xs text-ink-3">The AI Planner uses these when it plans for the client.</span>
          </Card>
        )}
        {q.loading && !q.data ? (
          <>
            <Skeleton className="h-64 rounded-card" />
            <Skeleton className="h-64 rounded-card" />
          </>
        ) : q.error && !q.data ? (
          <Card>
            <EmptyState title="Experiments didn't load" body={q.error} />
          </Card>
        ) : list.length === 0 ? (
          <Card>
            <EmptyState
              icon={<FlaskConical size={20} />}
              title="No A/B tests yet"
              body="Start a creative test with New test, or create an A/B test in Meta Ads Manager (Experiments → A/B test). Advertix picks up Meta's tests with the next sync and tells you which version wins and when you can trust it."
              action={
                <ButtonLink href="https://business.facebook.com/test-and-learn" target="_blank" rel="noreferrer" variant="secondary" size="sm" icon={<ExternalLink size={14} />}>
                  Open Meta Experiments
                </ButtonLink>
              }
            />
          </Card>
        ) : (
          list.map((e) => <TestCard key={`${e.id}-${e.lesson ?? ""}`} e={e} canEdit={canEdit} a={actions(e)} />)
        )}
        <p className="m-0 text-xs text-ink-3">
          Meta A/B tests split the audience so each person sees one version, which keeps the comparison fair. Advertix works out the chance each version is best from the results in the test window. Google, TikTok and LinkedIn tests follow once Advertix can write to those platforms.
        </p>
      </PageBody>
      <NewTestDialog open={creating} onClose={() => setCreating(false)} clientId={clientId} onStarted={() => void q.refetch()} />
      {dialog}
    </>
  );
}
