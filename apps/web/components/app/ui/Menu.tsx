"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { useEscape, useOutsideClick } from "./overlay-hooks";

// useLayoutEffect warns during server rendering; menus only measure in the browser.
const useBrowserLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Menu / dropdown (guide §4): surface, 1px line, radius 14, shadow-lg, 6px
 * padding; items 9×10 with radius 10; section labels 11/600 uppercase.
 * Closes on outside click, Esc, or on pick (unless `keepOpen`).
 *
 * The panel is rendered at the page level with fixed positioning, so it never
 * changes page layout and is never clipped by a scrolling container (DataGrid
 * rows, toolbars). It opens below the trigger, or above when there's more room
 * there; if neither side fits it caps its height and scrolls inside. It
 * follows the trigger on scroll / resize and closes if the trigger leaves the
 * screen.
 *
 *   <Menu trigger={(p) => <Button {...p}>Sort · Spend</Button>}>
 *     {(close) => <MenuItem onSelect={() => { setSort("spend"); close(); }}>Spend</MenuItem>}
 *   </Menu>
 */
type TriggerProps = {
  onClick: () => void;
  "aria-haspopup": "menu";
  "aria-expanded": boolean;
  /** Open-state styling: brand border + 3px brand-soft ring (guide §6). */
  className: string;
};

type Placement = { top: number; left: number; maxHeight?: number };
const GAP = 6;
const EDGE = 8;

export function Menu({
  trigger,
  children,
  align = "start",
  width = 240,
  className,
}: {
  trigger: (props: TriggerProps) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "start" | "end";
  width?: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Placement | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);

  useEscape(open, close);
  useOutsideClick(open, [wrapRef, panelRef], close);

  const place = useCallback(() => {
    const t = wrapRef.current?.getBoundingClientRect();
    const panel = panelRef.current;
    if (!t || !panel) return;
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    // Trigger scrolled out of view: nothing sensible to anchor to.
    if (t.bottom < 0 || t.top > vh) return setOpen(false);
    const h = panel.scrollHeight; // natural height, even while capped
    const below = vh - t.bottom - GAP - EDGE;
    const above = t.top - GAP - EDGE;
    let next: Placement;
    if (h <= below) next = { top: t.bottom + GAP, left: 0 };
    else if (h <= above) next = { top: t.top - GAP - h, left: 0 };
    else if (below >= above) next = { top: t.bottom + GAP, left: 0, maxHeight: Math.max(120, below) };
    else next = { top: t.top - GAP - Math.max(120, above), left: 0, maxHeight: Math.max(120, above) };
    const w = Math.min(width, vw - EDGE * 2);
    const left = align === "end" ? t.right - w : t.left;
    next.left = Math.max(EDGE, Math.min(left, vw - w - EDGE));
    setPos((p) => (p && p.top === next.top && p.left === next.left && p.maxHeight === next.maxHeight ? p : next));
  }, [align, width]);

  useBrowserLayoutEffect(() => {
    if (!open) return setPos(null);
    place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    let frame = 0;
    const onMove = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(place);
    };
    // Content can change size while open (e.g. Sort adds the Order section).
    const ro = typeof ResizeObserver !== "undefined" && panelRef.current ? new ResizeObserver(onMove) : null;
    if (ro && panelRef.current) ro.observe(panelRef.current);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      cancelAnimationFrame(frame);
      ro?.disconnect();
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open, place]);

  // Arrow keys move between items inside the panel.
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([aria-disabled="true"])') ?? []);
    if (!items.length) return;
    e.preventDefault();
    const i = items.indexOf(document.activeElement as HTMLElement);
    const next = e.key === "ArrowDown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
    items[next].focus();
  };

  return (
    <div ref={wrapRef} className={cn("relative inline-flex", className)}>
      {trigger({
        onClick: () => setOpen((o) => !o),
        "aria-haspopup": "menu",
        "aria-expanded": open,
        className: open ? "border-brand ring-[3px] ring-brand-soft" : "",
      })}
      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            onKeyDown={onKey}
            className="fixed z-[70] overflow-y-auto overscroll-contain rounded-menu border border-line bg-surface p-1.5 shadow-pop"
            // Hidden until measured so it never flashes in the wrong place.
            style={{
              width: `min(${width}px, calc(100vw - ${EDGE * 2}px))`,
              top: pos?.top ?? 0,
              left: pos?.left ?? 0,
              maxHeight: pos?.maxHeight,
              visibility: pos ? "visible" : "hidden",
            }}
          >
            {children(close)}
          </div>,
          document.body
        )}
    </div>
  );
}

export function MenuItem({
  onSelect,
  selected,
  disabled,
  icon,
  hint,
  children,
}: {
  onSelect: () => void;
  /** Shows a check (single-select lists such as Sort). */
  selected?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  /** Right-aligned secondary text (count, shortcut). */
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role={selected === undefined ? "menuitem" : "menuitemradio"}
      aria-checked={selected === undefined ? undefined : selected}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-ctl px-2.5 py-[9px] text-left text-sm text-ink transition-colors",
        "hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        selected && "bg-brand-soft text-brand-ink hover:bg-brand-soft"
      )}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hint && <span className="text-xs text-ink-3">{hint}</span>}
      {selected && <Check size={15} strokeWidth={2.5} aria-hidden="true" />}
    </button>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="px-2.5 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-[.06em] text-ink-3">{children}</div>;
}

export function MenuSeparator() {
  return <div role="separator" className="mx-1 my-1.5 h-px bg-line" />;
}
