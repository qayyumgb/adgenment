"use client";

import { useEffect, useRef, type RefObject } from "react";

// Open overlays, newest last: Escape closes only the top one (a confirm over a dialog).
const escapeStack: object[] = [];

/** Calls `onEscape` when Escape is pressed while `active` and this is the topmost overlay. */
export function useEscape(active: boolean, onEscape: () => void) {
  const cb = useRef(onEscape);
  cb.current = onEscape;
  useEffect(() => {
    if (!active) return;
    const me = {};
    escapeStack.push(me);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && escapeStack[escapeStack.length - 1] === me) {
        e.stopPropagation();
        cb.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      escapeStack.splice(escapeStack.indexOf(me), 1);
    };
  }, [active]);
}

/** Calls `onOutside` on a pointer-down outside every ref'd element. */
export function useOutsideClick(active: boolean, refs: RefObject<HTMLElement>[], onOutside: () => void) {
  const cb = useRef(onOutside);
  cb.current = onOutside;
  useEffect(() => {
    if (!active) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (refs.some((r) => r.current?.contains(t))) return;
      cb.current();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}

/** Locks page scroll while `active` (dialogs, drawers, mobile sheets). */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [active]);
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Keeps Tab focus inside `ref` while active, focuses the first control on
 * open and restores focus to the previously focused element on close.
 */
export function useFocusTrap(active: boolean, ref: RefObject<HTMLElement>) {
  useEffect(() => {
    if (!active || !ref.current) return;
    const root = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    const items = () => Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
    (items()[0] ?? root).focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const list = items();
      if (list.length === 0) {
        e.preventDefault();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    root.addEventListener("keydown", onKey);
    return () => {
      root.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [active, ref]);
}
