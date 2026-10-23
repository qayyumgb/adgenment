"use client";

import { useCallback, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useApiClient, type AiPlan, type PlanDetail, type PlanDraftsResult, type PlannerSteps, type PlannerTurn } from "@/lib/api";
import type { SavedVersionPlan } from "./format";

/**
 * AI Planner state (plan A12): the conversation, the reasoning steps (each
 * ticks when its work is actually done: the account read, then the plan),
 * the current plan and its saved versions, and the drafts made from it.
 *
 * Every plan the model returns is saved: the first as a new saved plan, each
 * refinement as its next version, with the conversation so far, so a saved
 * plan reopens where it was left.
 */

export type ChatMsg = {
  id: string;
  role: "user" | "assistant";
  text: string;
  /** Reasoning steps (latest answer only): how many are done, and what each found. */
  steps?: { done: number; details: PlannerSteps | null; clarify: boolean };
  questions?: string[];
  /** The request failed; `retry` is the message to send again. */
  error?: boolean;
  retry?: string;
};

export type PlanVersionEntry = { version: number; note: string | null; plan: AiPlan; chat: PlannerTurn[] };

let seq = 0;
const nextId = () => `m${++seq}`;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Bubbles for a saved conversation (no steps: those were for the live run). */
const toMessages = (chat: PlannerTurn[]): ChatMsg[] => chat.map((t) => ({ id: nextId(), role: t.role, text: t.content }));

export function usePlanner({ clientId }: { clientId: string | null }) {
  const api = useApiClient();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const transcript = useRef<PlannerTurn[]>([]);
  const [plan, setPlan] = useState<AiPlan | null>(null);
  const [thinking, setThinking] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [planId, setPlanId] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [versions, setVersions] = useState<PlanVersionEntry[]>([]);
  const [used, setUsed] = useState<Set<string>>(new Set());
  const [created, setCreated] = useState<PlanDraftsResult | null>(null);
  const [creating, setCreating] = useState(false);
  const run = useRef(0);
  const planIdRef = useRef<string | null>(null);

  const patchMsg = (id: string, p: Partial<ChatMsg>) => setMessages((ms) => ms.map((m) => (m.id === id ? { ...m, ...p } : m)));

  const save = useCallback(
    async (next: AiPlan, note: string): Promise<number | null> => {
      const body: SavedVersionPlan = { ...next, chat: [...transcript.current] };
      try {
        if (!planIdRef.current) {
          const brief = transcript.current.find((t) => t.role === "user")?.content ?? next.title;
          const d = await api.createPlan({ brief, plan: body, title: next.title, clientId: next.clientId, note: "First draft" });
          planIdRef.current = d.id;
          setPlanId(d.id);
          return 1;
        }
        const v = await api.addPlanVersion(planIdRef.current, { plan: body, note: note.slice(0, 200), title: next.title });
        return v.version;
      } catch (err) {
        toast.error(`This plan isn't saved: ${err instanceof Error ? err.message : "try again"}`);
        return null;
      }
    },
    [api]
  );

  const send = useCallback(
    async (text: string, opts: { clientId?: string | null; chip?: string } = {}) => {
      const content = text.trim();
      if (!content || thinking) return;
      const mine = ++run.current;
      const forClient = opts.clientId !== undefined ? opts.clientId : clientId;
      const aiId = nextId();
      // Earlier answers lose their steps box; only the newest shows it.
      setMessages((ms) => [...ms.map((m) => (m.steps ? { ...m, steps: undefined } : m)), { id: nextId(), role: "user", text: content }, { id: aiId, role: "assistant", text: "Working on it…", steps: { done: 0, details: null, clarify: false } }]);
      setSuggestions([]);
      setThinking(true);
      setCreated(null);
      if (opts.chip) setUsed((u) => new Set(u).add(opts.chip!));
      transcript.current = [...transcript.current, { role: "user", content }];

      // Steps 1–3 tick when the account read comes back (the planner re-reads it server-side too).
      const read = api
        .getPlannerContext(forClient)
        .then(async (ctx) => {
          for (let i = 1; i <= 3 && run.current === mine; i++) {
            setMessages((ms) => ms.map((m) => (m.id === aiId && m.steps && m.steps.done < i ? { ...m, steps: { ...m.steps, done: i, details: ctx.steps } } : m)));
            await wait(220);
          }
        })
        .catch(() => undefined);

      try {
        const res = await api.planCampaign({ messages: transcript.current, clientId: forClient, currentPlan: plan?.input ?? null });
        await read;
        if (run.current !== mine) return;
        const said = res.mode === "clarify" && res.questions.length ? `${res.reply}\n${res.questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}` : res.reply;
        transcript.current = [...transcript.current, { role: "assistant", content: said }];
        patchMsg(aiId, { text: res.reply, questions: res.mode === "clarify" ? res.questions : undefined, steps: { done: 4, details: res.steps, clarify: res.mode === "clarify" } });
        if (res.mode === "clarify") {
          setSuggestions(res.suggestions);
        } else {
          setPlan(res.plan);
          const v = await save(res.plan, opts.chip ?? content);
          if (run.current !== mine) return;
          const n = v ?? version + 1;
          setVersion(n);
          setVersions((vs) => [...vs.filter((x) => x.version !== n), { version: n, note: n === 1 ? "First draft" : (opts.chip ?? content), plan: res.plan, chat: [...transcript.current] }]);
        }
      } catch (err) {
        if (run.current !== mine) return;
        // Keep the user's bubble; drop their turn from the transcript so a retry isn't doubled.
        transcript.current = transcript.current.slice(0, -1);
        patchMsg(aiId, { text: err instanceof Error ? err.message : "Something went wrong. Try again.", error: true, retry: content, steps: undefined });
      } finally {
        if (run.current === mine) setThinking(false);
      }
    },
    [api, clientId, plan, save, thinking, version]
  );

  const retry = useCallback(
    (msg: ChatMsg) => {
      if (!msg.retry) return;
      // Remove the failed pair, then send it again.
      setMessages((ms) => {
        const i = ms.findIndex((m) => m.id === msg.id);
        return i > 0 ? [...ms.slice(0, i - 1), ...ms.slice(i + 1)] : ms;
      });
      void send(msg.retry);
    },
    [send]
  );

  const reset = useCallback(() => {
    run.current++;
    transcript.current = [];
    planIdRef.current = null;
    setMessages([]);
    setPlan(null);
    setThinking(false);
    setSuggestions([]);
    setPlanId(null);
    setVersion(0);
    setVersions([]);
    setUsed(new Set());
    setCreated(null);
  }, []);

  /** Open a saved plan at its latest version (or the one given). */
  const open = useCallback((detail: PlanDetail, at?: number) => {
    run.current++;
    const entries: PlanVersionEntry[] = detail.versions
      .map((v) => {
        const p = v.plan as unknown as SavedVersionPlan;
        const { chat, ...rest } = p;
        return { version: v.version, note: v.note, plan: rest as AiPlan, chat: chat ?? [] };
      })
      .filter((e) => e.plan && Array.isArray(e.plan.campaigns))
      .sort((a, b) => a.version - b.version);
    const pick = entries.find((e) => e.version === (at ?? detail.latestVersion)) ?? entries[entries.length - 1];
    planIdRef.current = detail.id;
    setPlanId(detail.id);
    setVersions(entries);
    setThinking(false);
    setSuggestions([]);
    setUsed(new Set());
    if (!pick) {
      transcript.current = [];
      setMessages([]);
      setPlan(null);
      setVersion(detail.latestVersion);
      return;
    }
    transcript.current = pick.chat;
    setMessages(toMessages(pick.chat));
    setPlan(pick.plan);
    setVersion(pick.version);
    const drafts = (detail.campaigns ?? []).filter((c) => c.planVersion === pick.version);
    setCreated(drafts.length ? { created: drafts.map((c) => ({ id: c.id, name: c.name, platform: c.platform })), skipped: [] } : null);
  }, []);

  /** Switch to another version of this plan (refining continues from it). */
  const showVersion = useCallback(
    (n: number) => {
      const e = versions.find((v) => v.version === n);
      if (!e || thinking) return;
      transcript.current = e.chat;
      setMessages(toMessages(e.chat));
      setPlan(e.plan);
      setVersion(n);
      setSuggestions([]);
      setCreated(null);
    },
    [thinking, versions]
  );

  const createDrafts = useCallback(async () => {
    if (!plan || creating) return;
    setCreating(true);
    try {
      let id = planIdRef.current;
      let v: number | null = version;
      if (!id) {
        v = await save(plan, "First draft");
        id = planIdRef.current;
      }
      if (!id || !v) return;
      const r = await api.createPlanDrafts(id, v);
      setCreated(r);
      if (r.created.length) toast.success(`${r.created.length} draft${r.created.length === 1 ? "" : "s"} created`);
      else toast.error("No drafts were created. See the reasons below.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The drafts weren't created. Try again.");
    } finally {
      setCreating(false);
    }
  }, [api, creating, plan, save, version]);

  return { messages, plan, thinking, suggestions, planId, version, versions, used, created, creating, send, retry, reset, open, showVersion, createDrafts };
}
