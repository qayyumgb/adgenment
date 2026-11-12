"use client";

import { AlertTriangle, CheckCircle2, Lightbulb } from "lucide-react";
import { Button, Dialog } from "@/components/app/ui";
import type { Finding } from "./designCheck";

/** C19c: the results of "Check design", each with "Show" to select what it's about. */
export function CheckDialog({ findings, onClose, onShow }: { findings: Finding[] | null; onClose: () => void; onShow: (f: Finding) => void }) {
  const warn = findings?.filter((f) => f.level === "warn").length ?? 0;
  return (
    <Dialog
      open={findings !== null}
      onClose={onClose}
      title="Design check"
      sub={findings && findings.length ? `${warn ? `${warn} thing${warn === 1 ? "" : "s"} to fix` : "Nothing to fix"}${findings.length - warn ? ` · ${findings.length - warn} tip${findings.length - warn === 1 ? "" : "s"}` : ""}` : undefined}
      width={560}
      footer={
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      }
    >
      {findings && findings.length === 0 ? (
        <p className="m-0 flex items-center gap-2 text-sm text-ink-2">
          <CheckCircle2 size={18} className="text-pos" aria-hidden="true" />
          Looks good: readable text sizes and contrast, nothing too close to the edges, no empty frames.
        </p>
      ) : (
        <ul className="m-0 flex max-h-[60vh] list-none flex-col gap-2 overflow-y-auto p-0">
          {findings?.map((f) => (
            <li key={f.id} className="flex items-start gap-3 rounded-ctl border border-line px-3 py-2.5">
              {f.level === "warn" ? <AlertTriangle size={16} className="mt-0.5 flex-none text-warn" aria-label="To fix" /> : <Lightbulb size={16} className="mt-0.5 flex-none text-brand" aria-label="Tip" />}
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[13px] font-semibold">{f.title}</span>
                <span className="text-xs leading-relaxed text-ink-2">{f.detail}</span>
              </span>
              {f.target && (
                <Button variant="secondary" size="sm" onClick={() => onShow(f)}>
                  Show
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
