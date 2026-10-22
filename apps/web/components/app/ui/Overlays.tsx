"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { IconButton } from "./Button";
import { useEscape, useFocusTrap, useScrollLock } from "./overlay-hooks";

function Portal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? createPortal(children, document.body) : null;
}

/**
 * Dialog (guide §4, Modals.dc.html D1–D7): radius 20; header with title,
 * sub and ✕; body; footer on surface-2 with buttons right-aligned.
 * Becomes a bottom sheet under 600px. Esc and the overlay close it.
 */
export function Dialog({
  open,
  onClose,
  title,
  sub,
  footer,
  width = 560,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  sub?: ReactNode;
  /** Usually [secondary, primary] buttons. */
  footer?: ReactNode;
  width?: number;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEscape(open, onClose);
  useScrollLock(open);
  useFocusTrap(open, panelRef);
  if (!open) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 min-[600px]:items-center min-[600px]:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className={cn(
            "flex max-h-[92vh] w-full flex-col overflow-hidden bg-surface text-ink shadow-pop outline-none",
            "rounded-t-[20px] min-[600px]:rounded-[20px]",
            "animate-[adx-sheet-in_.2s_ease-out] motion-reduce:animate-none"
          )}
          style={{ maxWidth: width }}
        >
          <div className="flex items-start gap-3 border-b border-line px-6 pb-4 pt-5">
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="m-0 text-lg font-semibold leading-snug">
                {title}
              </h2>
              {sub && <p className="m-0 mt-1 text-[13px] text-ink-2">{sub}</p>}
            </div>
            <IconButton label="Close" size={32} onClick={onClose} className="-mr-2 -mt-1">
              <X size={18} />
            </IconButton>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface-2 px-6 py-4">{footer}</div>}
        </div>
      </div>
    </Portal>
  );
}

/**
 * Drawer (guide §4): right side, min(440px, 100vw), sticky header with
 * close. Used for creative and account details.
 */
export function Drawer({
  open,
  onClose,
  title,
  sub,
  actions,
  width = 440,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  sub?: ReactNode;
  /** Extra header buttons, left of the close button. */
  actions?: ReactNode;
  width?: number;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEscape(open, onClose);
  useScrollLock(open);
  useFocusTrap(open, panelRef);
  if (!open) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-[60] bg-black/40" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <aside
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className="absolute inset-y-0 right-0 flex w-full flex-col overflow-y-auto bg-surface text-ink shadow-pop outline-none animate-[adx-drawer-in_.22s_ease-out] motion-reduce:animate-none"
          style={{ maxWidth: `min(${width}px, 100vw)` }}
        >
          <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-line bg-surface px-5 py-4">
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="m-0 truncate text-base font-semibold">
                {title}
              </h2>
              {sub && <p className="m-0 mt-0.5 text-[13px] text-ink-2">{sub}</p>}
            </div>
            {actions}
            <IconButton label="Close" size={32} onClick={onClose}>
              <X size={18} />
            </IconButton>
          </div>
          <div className="flex-1 px-5 py-5">{children}</div>
        </aside>
      </div>
    </Portal>
  );
}
