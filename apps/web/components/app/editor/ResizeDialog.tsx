"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button, Dialog } from "@/components/app/ui";

/**
 * One-click resize (plan C19b): pick the other ad sizes and get a new,
 * separate design for each, laid out for that size. The original stays as it
 * is. Each new version opens in the editor like any design.
 */

export const AD_SIZES = [
  { W: 1080, H: 1080, label: "Square", sub: "1:1 · Feed", suffix: "Square" },
  { W: 1200, H: 628, label: "Landscape", sub: "1.91:1 · Link ads", suffix: "Landscape" },
  { W: 1080, H: 1920, label: "Story", sub: "9:16 · Stories and Reels", suffix: "Story" },
] as const;
export type AdSize = (typeof AD_SIZES)[number];

type Made = { size: AdSize; id: string; preview: string } | { size: AdSize; error: string };

export function ResizeDialog({ open, onClose, W, H, make }: { open: boolean; onClose: () => void; W: number; H: number; make: (size: AdSize) => Promise<{ id: string; preview: string }> }) {
  const others = AD_SIZES.filter((s) => !(s.W === W && s.H === H));
  const [picked, setPicked] = useState<Set<string>>(new Set(others.map((s) => s.label)));
  const [running, setRunning] = useState<string | null>(null);
  const [made, setMade] = useState<Made[]>([]);
  useEffect(() => {
    if (!open) return;
    setPicked(new Set(AD_SIZES.filter((s) => !(s.W === W && s.H === H)).map((s) => s.label)));
    setMade([]);
  }, [open, W, H]);

  const run = async () => {
    setMade([]);
    for (const s of others.filter((x) => picked.has(x.label))) {
      setRunning(s.label);
      try {
        const r = await make(s);
        setMade((m) => [...m, { size: s, ...r }]);
      } catch (err) {
        setMade((m) => [...m, { size: s, error: err instanceof Error ? err.message : "Couldn't make this size." }]);
      }
    }
    setRunning(null);
  };

  const done = made.length > 0 && running === null;
  const count = others.filter((x) => picked.has(x.label)).length;

  return (
    <Dialog
      open={open}
      onClose={() => running === null && onClose()}
      title="Resize for other placements"
      sub="Get this ad in the other sizes as new designs, laid out for each size. This design stays as it is."
      width={560}
      footer={
        done ? (
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose} disabled={running !== null}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => void run()} loading={running !== null} disabled={!count}>
              {running ? `Making the ${running} version…` : `Create ${count} version${count === 1 ? "" : "s"}`}
            </Button>
          </>
        )
      }
    >
      {!done ? (
        <div className="grid grid-cols-2 gap-2.5">
          {others.map((s) => {
            const on = picked.has(s.label);
            return (
              <button
                key={s.label}
                type="button"
                role="checkbox"
                aria-checked={on}
                disabled={running !== null}
                onClick={() => setPicked((p) => (p.has(s.label) ? new Set([...p].filter((x) => x !== s.label)) : new Set([...p, s.label])))}
                className={cn("relative flex flex-col items-center gap-2 rounded-[14px] p-3 text-center transition-colors", on ? "border-[1.5px] border-brand bg-brand-soft" : "border border-line bg-surface hover:border-line-2")}
              >
                <span className={cn("absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-md border", on ? "border-brand bg-brand text-white" : "border-line-2 bg-surface")}>{on && <Check size={13} strokeWidth={3} />}</span>
                <span className="flex h-16 items-center justify-center">
                  <span className="rounded-[4px] border-2 border-current text-brand" style={{ width: s.W >= s.H ? 52 : 52 * (s.W / s.H), height: s.W >= s.H ? 52 * (s.H / s.W) : 52 }} aria-hidden="true" />
                </span>
                <span className="text-[13px] font-semibold">{s.label}</span>
                <span className="text-xs text-ink-2">
                  {s.sub} · {s.W}×{s.H}
                </span>
                {running === s.label && <Loader2 size={16} className="animate-spin text-brand" aria-label="Making it" />}
              </button>
            );
          })}
          <p className="col-span-2 m-0 text-xs leading-relaxed text-ink-3">Made from a template? Each size uses that template&apos;s own layout, with your text, photos and colours. Otherwise everything is repositioned to fit; check the text before you save it to Creatives.</p>
        </div>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {made.map((m) => (
            <li key={m.size.label} className="flex items-center gap-3 rounded-ctl border border-line p-2.5">
              {"id" in m ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.preview} alt="" className="h-16 w-16 flex-none rounded-md bg-surface-2 object-contain" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[13px] font-semibold">{m.size.label} version</span>
                    <span className="text-xs text-ink-2">Saved in Your designs</span>
                  </span>
                  <Link href={`/creatives/design/${m.id}`} className="inline-flex h-8 items-center rounded-ctl border border-line-2 px-3 text-[13px] font-semibold text-ink no-underline hover:border-brand hover:text-brand-ink">
                    Open
                  </Link>
                </>
              ) : (
                <span className="text-[13px] text-neg">
                  {m.size.label}: {m.error}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
