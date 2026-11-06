"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useApiClient } from "@/lib/api";
import { useAppRouter } from "@/hooks/useAppRouter";
import { cn } from "@/lib/cn";
import { Button, Dialog } from "@/components/app/ui";
import { useClientScope } from "@/components/app/shell/ClientContext";

/**
 * Start a design in the creative editor (plan C19a): pick the ad size (and
 * the client, when "All clients" is in view). From a library image
 * (`fromCreativeId`), the closest size is preselected and the image becomes
 * the background.
 */

const SIZES = [
  { width: 1080, height: 1080, label: "Square", ratio: "1:1", sub: "Feed posts" },
  { width: 1200, height: 628, label: "Landscape", ratio: "1.91:1", sub: "Link ads" },
  { width: 1080, height: 1920, label: "Vertical", ratio: "9:16", sub: "Stories and Reels" },
];

export function closestSize(w?: number | null, h?: number | null) {
  if (!w || !h) return 0;
  const r = w / h;
  return SIZES.map((s, i) => ({ i, d: Math.abs(Math.log(r / (s.width / s.height))) })).sort((a, b) => a.d - b.d)[0].i;
}

export function NewDesignDialog({ open, onClose, fromCreativeId, fromName, initialSize = 0 }: { open: boolean; onClose: () => void; fromCreativeId?: string | null; fromName?: string; initialSize?: number }) {
  const api = useApiClient();
  const router = useAppRouter();
  const scope = useClientScope();
  const [pick, setPick] = useState(initialSize);
  const [clientId, setClientId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setPick(initialSize);
    setClientId(scope.clientId ?? (scope.clients.length === 1 ? scope.clients[0].id : null));
  }, [open, initialSize, scope.clientId, scope.clients]);

  const start = async () => {
    const s = SIZES[pick];
    setBusy(true);
    try {
      const d = await api.createDesign({ name: fromName ? `${fromName} (design)` : `${s.label} ad`, width: s.width, height: s.height, clientId });
      onClose();
      router.push(`/creatives/design/${d.id}${fromCreativeId ? `?import=${encodeURIComponent(fromCreativeId)}` : ""}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't start the design.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={fromCreativeId ? "Open in the editor" : "Design an ad"}
      sub="Pick the size. You can add text, shapes, your logo and more next."
      width={560}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void start()} loading={busy}>
            Start designing
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-2.5" role="radiogroup" aria-label="Ad size">
          {SIZES.map((s, i) => (
            <button
              key={s.ratio}
              type="button"
              role="radio"
              aria-checked={pick === i}
              onClick={() => setPick(i)}
              className={cn("flex flex-col items-center gap-2 rounded-[14px] p-3 text-center transition-colors", pick === i ? "border-[1.5px] border-brand bg-brand-soft" : "border border-line bg-surface hover:border-line-2")}
            >
              <span className="flex h-16 items-center justify-center">
                <span className="rounded-[4px] border-2 border-current text-brand" style={{ width: s.width >= s.height ? 52 : 52 * (s.width / s.height), height: s.width >= s.height ? 52 * (s.height / s.width) : 52 }} aria-hidden="true" />
              </span>
              <span className="text-[13px] font-semibold">
                {s.label} · {s.ratio}
              </span>
              <span className="text-xs text-ink-2">
                {s.sub} · {s.width}×{s.height}
              </span>
            </button>
          ))}
        </div>
        {!scope.clientId && scope.clients.length > 1 && (
          <label className="flex flex-col gap-1.5 text-[13px]">
            <span className="font-medium">Client</span>
            <select value={clientId ?? ""} onChange={(e) => setClientId(e.target.value || null)} className="h-10 rounded-ctl border border-line-2 bg-surface px-3 text-sm text-ink outline-none focus:border-brand">
              <option value="">Shared (all clients)</option>
              {scope.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </Dialog>
  );
}
