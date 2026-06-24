"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";

/**
 * Reusable modal primitive. Handles the boring parts so every modal in the
 * app gets enterprise-grade behavior without reimplementing the same wiring:
 *
 *  - Renders into a React Portal at `document.body` so it escapes any parent
 *    overflow/transform/z-index context (the dashboard's `<main>` has
 *    `overflow-y-auto`, which clipped inline modals).
 *  - Locks page scroll while open and restores the original `overflow` value
 *    on unmount — prevents the page behind from scrolling and the double-
 *    scrollbar effect we used to get.
 *  - Strong backdrop (`bg-slate-900/80 backdrop-blur-sm`) so the page
 *    underneath visually recedes.
 *  - Click backdrop → close. ESC → close. Both opt-out-able if a child needs
 *    to gate dismissal (e.g. mid-upload).
 *  - Centers the modal, caps it at `90vh`, and the children area scrolls
 *    independently. Header + footer slots stay pinned.
 *  - SSR-safe via a `mounted` guard so we don't try to portal during the
 *    server render.
 */
export function Modal({
  open,
  onClose,
  size = "md",
  position = "center",
  closeOnBackdrop = true,
  closeOnEscape = true,
  ariaLabel,
  children,
}: {
  open: boolean;
  onClose: () => void;
  size?: "sm" | "md" | "lg" | "xl";
  /** "center" → traditional centered dialog (default).
   *  "right" → right-side slide-in panel covering 90vw, used for the AI
   *  Generate workspace where users want a roomier canvas-style surface. */
  position?: "center" | "right";
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  ariaLabel?: string;
  children: React.ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  // Lock body scroll while open + restore on unmount. Save the original value
  // so we don't blow away a parent's intentional `overflow: hidden`.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // ESC to close.
  useEffect(() => {
    if (!open || !closeOnEscape) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, closeOnEscape, onClose]);

  // Focus the dialog when it opens so screen readers + keyboard users land
  // somewhere predictable. (Not a full focus trap — that's a separate concern
  // and most of our modals are short-lived.)
  useEffect(() => {
    if (open && dialogRef.current) {
      dialogRef.current.focus();
    }
  }, [open]);

  if (!open) return null;

  // SSR guard — `document` doesn't exist server-side, so we can't portal.
  if (typeof document === "undefined") return null;

  const sizeClass = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  }[size];

  // Right-side slide-in panel — 90vw wide, full height, slides in from the
  // right via the global `slide-in-right` keyframe + animate-* class. Center
  // mode keeps the original capped-height centered dialog.
  if (position === "right") {
    return createPortal(
      <div
        className="fixed inset-0 z-[100] flex animate-in"
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={closeOnBackdrop ? onClose : undefined}
          className="absolute inset-0 cursor-default bg-slate-900/70 backdrop-blur-sm"
          tabIndex={-1}
        />
        <div
          ref={dialogRef}
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
          className="relative z-10 ml-auto flex h-full w-[90vw] flex-col overflow-hidden bg-white shadow-2xl outline-none animate-slide-in-right"
        >
          {children}
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      {/* Backdrop — stronger dim than the previous /60 so the page below
          actually recedes visually. */}
      <button
        type="button"
        aria-label="Close"
        onClick={closeOnBackdrop ? onClose : undefined}
        className="absolute inset-0 cursor-default bg-slate-900/80 backdrop-blur-sm"
        tabIndex={-1}
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={clsx(
          "relative z-10 flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl outline-none",
          sizeClass
        )}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

/** Pinned header slot for `<Modal>`. Use this so the close X and title stay
 *  visible while the body scrolls. */
export function ModalHeader({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "flex items-start justify-between gap-3 border-b border-slate-100 px-6 py-4",
        className
      )}
    >
      {children}
    </div>
  );
}

/** Scrollable body slot. The `flex-1 overflow-y-auto` here is what makes the
 *  modal's content scroll while header/footer stay pinned. */
export function ModalBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("flex-1 overflow-y-auto px-6 py-5", className)}>
      {children}
    </div>
  );
}

/** Pinned footer slot — typically holds Cancel / Confirm buttons. */
export function ModalFooter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-3",
        className
      )}
    >
      {children}
    </div>
  );
}
