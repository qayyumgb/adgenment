"use client";

import { useState, type FormEvent } from "react";
import { ArrowUp } from "lucide-react";
import { useApiClient } from "@/lib/api";
import { cn } from "@/lib/cn";
import { Card, Skeleton } from "@/components/app/ui";

type Turn = { role: "user" | "assistant"; content: string };

const STARTERS = ["How is this campaign doing?", "Why did results change this week?", "Is it ready to scale?"];

/**
 * "Ask about this campaign" (guide §5.3, plan B5 endpoint). Answers come only
 * from this campaign's own last-30-day data; the conversation lives in the
 * page and is sent back so follow-ups have context.
 */
export function AskCampaign({ campaignId, campaignName }: { campaignId: string; campaignName: string }) {
  const api = useApiClient();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || pending) return;
    setError(null);
    setPending(q);
    setDraft("");
    try {
      const res = await api.askCampaign(campaignId, q, turns);
      setTurns((t) => [...t, { role: "user", content: q }, { role: "assistant", content: res.answer }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't get an answer. Try again.");
      setDraft(q);
    } finally {
      setPending(null);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void ask(draft);
  };

  // Newest exchange first, so the answer appears right under the input.
  const pairs: { q: string; a: string }[] = [];
  for (let i = 0; i + 1 < turns.length; i += 2) pairs.unshift({ q: turns[i].content, a: turns[i + 1].content });

  return (
    <Card className="flex flex-col gap-3 px-5 py-[18px]">
      <span className="font-semibold">Ask about this campaign</span>
      {turns.length === 0 && (
        <div className="flex flex-wrap gap-1.5">
          {STARTERS.map((s) => (
            <button
              key={s}
              type="button"
              disabled={!!pending}
              onClick={() => void ask(s)}
              className="rounded-full border border-line-2 bg-surface px-[11px] py-[5px] text-left text-[13px] leading-[1.35] text-ink-2 transition-colors hover:border-brand hover:bg-brand-soft hover:text-brand-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-soft disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <form onSubmit={onSubmit} className="flex items-center gap-1.5 rounded-menu border border-line-2 bg-surface-2 py-1 pl-3 pr-1 focus-within:border-brand focus-within:ring-[3px] focus-within:ring-brand-soft">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={500}
          placeholder={`Ask anything about ${campaignName}`}
          aria-label={`Ask a question about ${campaignName}`}
          className="h-[34px] min-w-0 flex-1 border-0 bg-transparent text-sm text-ink outline-none placeholder:text-ink-3"
        />
        <button
          type="submit"
          aria-label="Ask"
          disabled={!draft.trim() || !!pending}
          className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[9px] bg-brand text-white transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-soft disabled:opacity-40"
        >
          <ArrowUp size={16} strokeWidth={2.5} />
        </button>
      </form>
      {error && (
        <p role="alert" className="text-[13px] text-neg">
          {error}
        </p>
      )}
      <div aria-live="polite" className="flex flex-col gap-2">
        {pending && (
          <div className="flex flex-col gap-2 rounded-menu bg-brand-soft p-3.5">
            <span className="text-xs font-semibold text-brand-ink">{pending}</span>
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-4/5" />
          </div>
        )}
        {pairs.map((p, i) => (
          <div key={pairs.length - i} className={cn("flex flex-col gap-1.5 rounded-menu p-3.5", i === 0 && !pending ? "bg-brand-soft" : "bg-surface-2")}>
            <span className="text-xs font-semibold text-brand-ink">{p.q}</span>
            <span className="whitespace-pre-line text-sm [text-wrap:pretty]">{p.a}</span>
          </div>
        ))}
      </div>
      {turns.length > 0 && <p className="text-xs text-ink-3">Answers use this campaign’s last 30 days only.</p>}
    </Card>
  );
}
