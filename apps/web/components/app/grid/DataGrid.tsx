"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from "react";
import { AlignJustify, ArrowDownUp, Check, Columns3, LayoutGrid, Rows3, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button, Checkbox, Menu, MenuLabel, MenuSeparator, Segmented, Skeleton } from "@/components/app/ui";

/**
 * DataGrid (guide §4.1) — every table in the app.
 *
 * - Toolbar: page filters on the left; Sort, Columns and Row height on the
 *   right as one group that wraps as a unit.
 * - The grid scrolls sideways inside its card. Only the Action column is
 *   sticky (right, soft left shadow); the identity column scrolls.
 * - Row selection with a floating dark bulk bar; footer totals row.
 * - Sort, hidden columns, row height and wrap persist per table in
 *   localStorage `advertix.grid.<tableId>`.
 *
 * The first column is the identity column: always shown, carries the row
 * checkbox. Sorting is client-side over the rows passed in (pass rows that are
 * already filtered).
 */

export type SortDir = "asc" | "desc";
export type Density = "comfortable" | "compact";
export type GridDisplay = { density: Density; wrap: boolean };

export type GridColumn<T> = {
  id: string;
  /** Header text; also used in the Sort and Columns menus. */
  label: string;
  /** Custom header content (e.g. an icon + label). Falls back to `label`. */
  header?: ReactNode;
  /** Minimum width in px. */
  width: number;
  /** Share of leftover width (`fr`). Omit for a fixed-width column. */
  grow?: number;
  align?: "left" | "right";
  /** Makes the column sortable (Sort menu + clickable header). */
  sortValue?: (row: T) => number | string | null | undefined;
  /** Order labels: text → A→Z / Z→A, number → High to low / Low to high. Inferred when omitted. */
  sortType?: "text" | "number";
  /** Hidden until the user turns it on in Columns. */
  defaultHidden?: boolean;
  render: (row: T, display: GridDisplay) => ReactNode;
  /** Footer totals cell. */
  footer?: ReactNode;
};

export type GridAction<T> = {
  label?: string;
  /** Column width in px, including its 16px side padding. */
  width?: number;
  render: (row: T, display: GridDisplay) => ReactNode;
};

export type GridView = "table" | "cards";

type GridPrefs = {
  sort: { id: string; dir: SortDir } | null;
  hidden: string[];
  density: Density;
  wrap: boolean;
  view: GridView;
};

const ROW_HEIGHT: Record<Density, number> = { comfortable: 64, compact: 48 };
const CELL_PAD: Record<Density, string> = { comfortable: "py-3", compact: "py-1.5" };
const GAP = 16;
const CHECKBOX = 18 + GAP;
const STICKY_SHADOW = "shadow-[-1px_0_0_var(--line),-8px_0_12px_-8px_rgba(22,20,40,.18)]";

/* ── Display context (row height / wrap) for cell renderers ───────────────── */

const DisplayContext = createContext<GridDisplay>({ density: "comfortable", wrap: false });

export function useGridDisplay() {
  return useContext(DisplayContext);
}

/**
 * Text cell that follows "Wrap long values": truncates with a tooltip when off,
 * wraps when on. Optional secondary line.
 */
export function CellText({
  children,
  sub,
  title,
  strong = false,
  className,
}: {
  children: ReactNode;
  sub?: ReactNode;
  /** Tooltip for truncated text. Defaults to the text itself when it's a string. */
  title?: string;
  strong?: boolean;
  className?: string;
}) {
  const { wrap } = useGridDisplay();
  const tip = wrap ? undefined : title ?? (typeof children === "string" ? children : undefined);
  const line = wrap ? "whitespace-normal [text-wrap:pretty]" : "truncate";
  return (
    <span className={cn("flex min-w-0 flex-col leading-[1.35]", className)} title={tip}>
      <span className={cn(line, strong && "font-semibold")}>{children}</span>
      {sub && <span className={cn(line, "text-xs text-ink-2")}>{sub}</span>}
    </span>
  );
}

/* ── Persisted preferences ────────────────────────────────────────────────── */

function readPrefs(key: string): Partial<GridPrefs> | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Partial<GridPrefs>) : null;
  } catch {
    return null;
  }
}

function writePrefs(key: string, prefs: GridPrefs) {
  try {
    window.localStorage.setItem(key, JSON.stringify(prefs));
  } catch {
    /* storage unavailable: preferences just don't persist */
  }
}

function useGridPrefs<T>(tableId: string, columns: GridColumn<T>[], defaultSort: GridPrefs["sort"], defaultDensity: Density) {
  const key = `advertix.grid.${tableId}`;
  const defaultHidden = useMemo(() => columns.filter((c) => c.defaultHidden).map((c) => c.id), [columns]);
  const [prefs, setPrefs] = useState<GridPrefs>({ sort: defaultSort, hidden: defaultHidden, density: defaultDensity, wrap: false, view: "table" });

  // Read after mount so server and client render the same first frame.
  // Phones start in card view until someone picks a view for this table.
  useEffect(() => {
    const stored = readPrefs(key);
    const phone = window.matchMedia("(max-width: 767px)").matches;
    if (!stored) {
      if (phone) setPrefs((p) => ({ ...p, view: "cards" }));
      return;
    }
    const ids = new Set(columns.map((c) => c.id));
    const sortable = new Set(columns.filter((c) => c.sortValue).map((c) => c.id));
    setPrefs((p) => ({
      sort:
        stored.sort === null
          ? null
          : stored.sort && sortable.has(stored.sort.id) && (stored.sort.dir === "asc" || stored.sort.dir === "desc")
            ? stored.sort
            : p.sort,
      hidden: Array.isArray(stored.hidden) ? stored.hidden.filter((id) => ids.has(id) && id !== columns[0]?.id) : p.hidden,
      density: stored.density === "compact" || stored.density === "comfortable" ? stored.density : p.density,
      wrap: typeof stored.wrap === "boolean" ? stored.wrap : p.wrap,
      view: stored.view === "cards" || stored.view === "table" ? stored.view : phone ? "cards" : p.view,
    }));
    // Only on table change; column definitions are expected to be stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = (patch: Partial<GridPrefs>) =>
    setPrefs((p) => {
      const next = { ...p, ...patch };
      writePrefs(key, next);
      return next;
    });

  return { prefs, update, defaultHidden };
}

/* ── Sorting ──────────────────────────────────────────────────────────────── */

function sortTypeOf<T>(col: GridColumn<T>, rows: T[]): "text" | "number" {
  if (col.sortType) return col.sortType;
  for (const r of rows) {
    const v = col.sortValue?.(r);
    if (v !== null && v !== undefined) return typeof v === "string" ? "text" : "number";
  }
  return "number";
}

function sortRows<T>(rows: T[], col: GridColumn<T> | undefined, dir: SortDir): T[] {
  if (!col?.sortValue) return rows;
  const get = col.sortValue;
  const sign = dir === "asc" ? 1 : -1;
  return rows
    .map((row, i) => ({ row, i, v: get(row) }))
    .sort((a, b) => {
      // Empty values always last, whatever the direction.
      const an = a.v === null || a.v === undefined;
      const bn = b.v === null || b.v === undefined;
      if (an || bn) return an && bn ? a.i - b.i : an ? 1 : -1;
      const c =
        typeof a.v === "string" || typeof b.v === "string"
          ? String(a.v).localeCompare(String(b.v), undefined, { numeric: true, sensitivity: "base" })
          : (a.v as number) - (b.v as number);
      return c * sign || a.i - b.i;
    })
    .map((x) => x.row);
}

function orderOptions(type: "text" | "number") {
  return type === "text"
    ? [
        { value: "asc" as SortDir, label: "A → Z" },
        { value: "desc" as SortDir, label: "Z → A" },
      ]
    : [
        { value: "desc" as SortDir, label: "High to low" },
        { value: "asc" as SortDir, label: "Low to high" },
      ];
}

/* ── Small pieces ─────────────────────────────────────────────────────────── */

function CheckBox({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[5px] border-[1.5px] text-white",
        on ? "border-brand bg-brand" : "border-line-2 bg-surface"
      )}
    >
      {on && <Check size={12} strokeWidth={3.5} />}
    </span>
  );
}

const menuRow =
  "flex w-full items-center gap-2.5 rounded-ctl px-2.5 py-[9px] text-left text-sm text-ink transition-colors " +
  "hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none";

const toolbarBtn = "px-3 text-[13px]";

/** Search field for the toolbar's filter area (240px; full width on phones). */
export function GridSearch({
  value,
  onChange,
  placeholder = "Filter by name",
  label = "Filter rows",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label?: string;
}) {
  return (
    <label className="flex h-9 w-full items-center gap-2 rounded-ctl border border-line bg-surface-2 px-3 text-ink-3 focus-within:border-brand focus-within:ring-[3px] focus-within:ring-brand-soft min-[600px]:w-60">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <input
        type="search"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 border-0 bg-transparent text-sm text-ink outline-none placeholder:text-ink-3 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button type="button" aria-label="Clear filter" onClick={() => onChange("")} className="flex text-ink-3 hover:text-ink">
          <X size={14} />
        </button>
      )}
    </label>
  );
}

/**
 * Multi-select filter dropdown (Platform, Type): shows picked marks on the
 * button, has Clear and Done (guide §4.1, §6).
 */
export function FilterMultiSelect({
  label,
  options,
  value,
  onChange,
  allLabel = "All",
  width = 260,
}: {
  label: string;
  options: { value: string; label: string; icon?: ReactNode; count?: number }[];
  value: string[];
  onChange: (v: string[]) => void;
  allLabel?: string;
  width?: number;
}) {
  const picked = options.filter((o) => value.includes(o.value));
  const summary = picked.length === 0 ? allLabel : picked.length === 1 ? picked[0].label : `${picked.length} selected`;
  return (
    <Menu
      width={width}
      trigger={(p) => (
        <Button {...p} variant="secondary" size="toolbar" className={cn(toolbarBtn, "font-medium", p.className)}>
          <span className="text-ink-2">{label}</span>
          {picked.some((o) => o.icon) && (
            <span className="flex pl-[5px]">
              {picked.map((o) =>
                o.icon ? (
                  <span key={o.value} className="-ml-[5px] flex rounded-full shadow-[0_0_0_2px_var(--surface)]">
                    {o.icon}
                  </span>
                ) : null
              )}
            </span>
          )}
          <span className="font-semibold">{summary}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </Button>
      )}
    >
      {(close) => (
        <>
          <MenuLabel>{label}</MenuLabel>
          {options.map((o) => {
            const on = value.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                role="menuitemcheckbox"
                aria-checked={on}
                onClick={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}
                className={cn(menuRow, on && "bg-surface-2")}
              >
                <CheckBox on={on} />
                {o.icon}
                <span className="flex-1 font-medium">{o.label}</span>
                {o.count !== undefined && <span className="text-xs tabular-nums text-ink-3">{o.count}</span>}
              </button>
            );
          })}
          <div className="mt-1 flex justify-between gap-2 border-t border-line px-1 pb-0.5 pt-2">
            <Button variant="ghost" size="sm" onClick={() => onChange([])} disabled={value.length === 0}>
              Clear
            </Button>
            <Button variant="primary" size="sm" className="h-8 px-3.5 text-[13px]" onClick={close}>
              Done
            </Button>
          </div>
        </>
      )}
    </Menu>
  );
}

/** Button for the floating bulk bar. */
export function BulkButton({ className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "h-[34px] whitespace-nowrap rounded-[9px] px-3 font-medium text-inherit transition-colors",
        "hover:bg-[color-mix(in_srgb,var(--surface)_14%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--surface)_40%,transparent)]",
        "disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent",
        className
      )}
      {...rest}
    />
  );
}

/** Empty state inside the grid body (left-aligned, guide §4 empty state). */
export function GridEmpty({ title, body, action }: { title: ReactNode; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex max-w-[640px] flex-col items-start gap-2 px-6 py-14">
      <span className="text-lg font-semibold">{title}</span>
      {body && <span className="text-ink-2">{body}</span>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/* ── DataGrid ─────────────────────────────────────────────────────────────── */

export function DataGrid<T>({
  tableId,
  label,
  rows,
  getRowId,
  columns,
  action,
  defaultSort = null,
  defaultDensity = "comfortable",
  selectable = false,
  rowLabel,
  bulkActions,
  filters,
  footerLabel,
  loading = false,
  empty,
  renderCards,
  cardView = true,
  cardMinWidth = 280,
  className,
}: {
  /** Key for persisted preferences: `advertix.grid.<tableId>`. */
  tableId: string;
  /** Accessible name of the table. */
  label: string;
  rows: T[];
  getRowId: (row: T) => string;
  /** First column = identity column (always shown, carries the checkbox). */
  columns: GridColumn<T>[];
  /** Sticky right Action column. */
  action?: GridAction<T>;
  defaultSort?: { id: string; dir: SortDir } | null;
  /** Row height until the user picks one (e.g. "compact" for long numeric tables). */
  defaultDensity?: Density;
  selectable?: boolean;
  /** Accessible name for a row's checkbox ("Select Spring sale"). */
  rowLabel?: (row: T) => string;
  /** Floating bulk bar content; shown while rows are selected. */
  bulkActions?: (ctx: { ids: string[]; rows: T[]; clear: () => void }) => ReactNode;
  /** Filters left of the Sort / Columns / Row height group. */
  filters?: ReactNode;
  /** Footer row label. Pass to show the footer (column `footer` cells fill it). */
  footerLabel?: ReactNode;
  loading?: boolean;
  /** Shown when there are no rows (use GridEmpty). */
  empty?: ReactNode;
  /**
   * Enables the table / cards switch (persisted with the other preferences).
   * Gets the filtered rows in the current sort order; render one card per row.
   * In card view Sort stays, Columns / Row height and selection don't apply.
   */
  renderCards?: (rows: T[]) => ReactNode;
  /**
   * Without `renderCards`, card view is built from the columns: the first
   * column as the title, the visible others as label / value pairs, the
   * action top right. Pass false to keep a grid table-only.
   */
  cardView?: boolean;
  /** Minimum card width in the responsive card grid. */
  cardMinWidth?: number;
  className?: string;
}) {
  const { prefs, update, defaultHidden } = useGridPrefs(tableId, columns, defaultSort, defaultDensity);
  const display: GridDisplay = { density: prefs.density, wrap: prefs.wrap };
  const canCards = Boolean(renderCards) || cardView;
  const cards = canCards && prefs.view === "cards";

  const identity = columns[0];
  const rest = columns.slice(1);
  const visible = rest.filter((c) => !prefs.hidden.includes(c.id));
  const sortable = columns.filter((c) => c.sortValue);
  const sortCol = prefs.sort ? sortable.find((c) => c.id === prefs.sort?.id) : undefined;
  const sortDir: SortDir = prefs.sort?.dir ?? "desc";
  const sorted = useMemo(() => sortRows(rows, sortCol, sortDir), [rows, sortCol, sortDir]);

  // Selection is limited to the rows currently shown, so bulk actions never
  // touch rows a filter has hidden.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const rowIds = useMemo(() => new Set(rows.map(getRowId)), [rows, getRowId]);
  useEffect(() => {
    setSelected((s) => {
      const next = new Set(Array.from(s).filter((id) => rowIds.has(id)));
      return next.size === s.size ? s : next;
    });
  }, [rowIds]);
  // Selection belongs to the table; switching to cards clears it.
  useEffect(() => {
    if (cards) setSelected((s) => (s.size ? new Set() : s));
  }, [cards]);
  const selCount = selected.size;
  const allOn = rows.length > 0 && selCount === rows.length;
  const clearSel = () => setSelected(new Set());
  const toggleRow = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Tracks: identity (+ checkbox, 16px lead padding), visible columns, action.
  const lead = 16 + (selectable ? CHECKBOX : 0);
  const track = (c: GridColumn<T>, extra = 0) => (c.grow ? `minmax(${c.width + extra}px, ${c.grow}fr)` : `${c.width + extra}px`);
  const actionWidth = action ? action.width ?? 140 : 0;
  const templateColumns = [track(identity, lead), ...visible.map((c) => track(c)), ...(action ? [`${actionWidth}px`] : [])].join(" ");
  const minWidth =
    identity.width + lead + visible.reduce((n, c) => n + c.width, 0) + (action ? actionWidth : 16) + GAP * (visible.length + (action ? 1 : 0));
  const rowStyle: CSSProperties = { gridTemplateColumns: templateColumns, columnGap: GAP };
  const rowBase = cn("grid items-center", !action && "pr-4");

  const pickSort = (c: GridColumn<T>) => {
    if (prefs.sort?.id === c.id) update({ sort: { id: c.id, dir: sortDir === "asc" ? "desc" : "asc" } });
    else update({ sort: { id: c.id, dir: sortTypeOf(c, rows) === "text" ? "asc" : "desc" } });
  };
  const hiddenCount = rest.filter((c) => prefs.hidden.includes(c.id)).length;

  const headerCell = (c: GridColumn<T>, first = false) => {
    const active = sortCol?.id === c.id;
    const right = c.align === "right";
    const content = c.header ?? c.label;
    return (
      <div
        key={c.id}
        role="columnheader"
        aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : undefined}
        className={cn("flex min-w-0 items-center", right && "justify-end", first && "gap-4 pl-4")}
      >
        {first && selectable && (
          <Checkbox
            checked={allOn}
            indeterminate={selCount > 0 && !allOn}
            onChange={() => (allOn ? clearSel() : setSelected(new Set(rows.map(getRowId))))}
            label="Select all rows"
            hideLabel
            disabled={loading || rows.length === 0}
          />
        )}
        {c.sortValue ? (
          <button
            type="button"
            onClick={() => pickSort(c)}
            className={cn(
              "flex items-center gap-1 whitespace-nowrap rounded text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
              right && "flex-row-reverse",
              active ? "font-semibold text-ink" : "font-medium text-ink-2 hover:text-ink"
            )}
          >
            {content}
            <span className={cn("w-2.5", right ? "text-right" : "text-left")} aria-hidden="true">
              {active ? (sortDir === "asc" ? "↑" : "↓") : ""}
            </span>
          </button>
        ) : (
          <span className="truncate">{content}</span>
        )}
      </div>
    );
  };

  const stickyCell = "sticky right-0 z-[2] flex items-center self-stretch bg-inherit px-4";

  return (
    <DisplayContext.Provider value={display}>
      <div className={cn("flex flex-col", className)}>
        <div className="rounded-card border border-line bg-surface shadow-card">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2.5 border-b border-line px-4 py-3.5">
            {filters}
            <div className="ml-auto flex gap-2">
              {canCards && (
                <Segmented
                  label="View"
                  value={prefs.view}
                  onChange={(v) => update({ view: v })}
                  options={[
                    {
                      value: "table" as GridView,
                      label: (
                        <span className="flex items-center" title="Table">
                          <Rows3 size={16} aria-hidden="true" />
                          <span className="sr-only">Table</span>
                        </span>
                      ),
                    },
                    {
                      value: "cards" as GridView,
                      label: (
                        <span className="flex items-center" title="Cards">
                          <LayoutGrid size={16} aria-hidden="true" />
                          <span className="sr-only">Cards</span>
                        </span>
                      ),
                    },
                  ]}
                />
              )}
              <Menu
                align="end"
                width={240}
                trigger={(p) => (
                  <Button {...p} variant="secondary" size="toolbar" className={cn(toolbarBtn, p.className)} icon={<ArrowDownUp size={15} />}>
                    Sort
                    {sortCol && <span className="font-medium text-ink-2 max-[599px]:hidden">· {sortCol.label}</span>}
                  </Button>
                )}
              >
                {() => (
                  <>
                    <MenuLabel>Sort by</MenuLabel>
                    {sortable.map((c) => {
                      const on = sortCol?.id === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          role="menuitemradio"
                          aria-checked={on}
                          onClick={() => update({ sort: { id: c.id, dir: sortTypeOf(c, rows) === "text" ? "asc" : "desc" } })}
                          className={cn(menuRow, on ? "bg-brand-soft font-semibold text-brand-ink hover:bg-brand-soft" : "font-medium")}
                        >
                          <span className="flex w-4 flex-none">{on && <Check size={16} strokeWidth={2.5} />}</span>
                          {c.label}
                        </button>
                      );
                    })}
                    {sortCol && (
                      <>
                        <div className="mt-1 border-t border-line" />
                        <MenuLabel>Order</MenuLabel>
                        <div className="mx-1.5 mb-1.5">
                          <Segmented
                            label="Sort order"
                            stretch
                            options={orderOptions(sortTypeOf(sortCol, rows))}
                            value={sortDir}
                            onChange={(dir) => update({ sort: { id: sortCol.id, dir } })}
                          />
                        </div>
                      </>
                    )}
                  </>
                )}
              </Menu>

              {!cards && (
              <>
              <Menu
                align="end"
                width={260}
                trigger={(p) => (
                  <Button {...p} variant="secondary" size="toolbar" className={cn(toolbarBtn, p.className)} icon={<Columns3 size={15} />}>
                    Columns
                    {hiddenCount > 0 && <span className="font-medium text-ink-2 max-[599px]:hidden">· {hiddenCount} hidden</span>}
                  </Button>
                )}
              >
                {() => (
                  <>
                    <MenuLabel>Show columns</MenuLabel>
                    <div className={cn(menuRow, "cursor-default hover:bg-transparent")} aria-disabled="true">
                      <CheckBox on />
                      <span className="flex-1 font-medium text-ink-2">{identity.label}</span>
                      <span className="text-xs text-ink-3">Always shown</span>
                    </div>
                    {rest.map((c) => {
                      const on = !prefs.hidden.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          role="menuitemcheckbox"
                          aria-checked={on}
                          onClick={() => update({ hidden: on ? [...prefs.hidden, c.id] : prefs.hidden.filter((id) => id !== c.id) })}
                          className={menuRow}
                        >
                          <CheckBox on={on} />
                          <span className="flex-1 font-medium">{c.label}</span>
                        </button>
                      );
                    })}
                    {action && (
                      <div className={cn(menuRow, "cursor-default hover:bg-transparent")} aria-disabled="true">
                        <CheckBox on />
                        <span className="flex-1 font-medium text-ink-2">{action.label ?? "Action"}</span>
                        <span className="text-xs text-ink-3">Always shown</span>
                      </div>
                    )}
                    <div className="mt-1 border-t border-line px-1 pb-0.5 pt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="font-semibold text-brand hover:bg-brand-soft hover:text-brand"
                        onClick={() => update({ hidden: defaultHidden })}
                      >
                        Reset to default
                      </Button>
                    </div>
                  </>
                )}
              </Menu>

              <Menu
                align="end"
                width={280}
                trigger={(p) => (
                  <Button
                    {...p}
                    variant="secondary"
                    size="toolbar"
                    aria-label="Row height and display"
                    title="Row height and display"
                    className={cn("w-9 px-0", p.className)}
                  >
                    <AlignJustify size={16} />
                  </Button>
                )}
              >
                {() => (
                  <>
                    <MenuLabel>Row height</MenuLabel>
                    {(
                      [
                        ["comfortable", "Comfortable", "64px rows"],
                        ["compact", "Compact", "48px rows — more on screen"],
                      ] as const
                    ).map(([value, name, sub]) => {
                      const on = prefs.density === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          role="menuitemradio"
                          aria-checked={on}
                          onClick={() => update({ density: value })}
                          className={cn(menuRow, "items-start", on && "bg-surface-2")}
                        >
                          <span className="flex w-4 flex-none pt-0.5 text-brand">{on && <Check size={16} strokeWidth={2.5} />}</span>
                          <span className="flex flex-col leading-[1.35]">
                            <span className={cn("font-semibold", on && "text-brand-ink")}>{name}</span>
                            <span className="text-xs text-ink-2">{sub}</span>
                          </span>
                        </button>
                      );
                    })}
                    <MenuSeparator />
                    <button type="button" role="menuitemcheckbox" aria-checked={prefs.wrap} onClick={() => update({ wrap: !prefs.wrap })} className={menuRow}>
                      <span className="flex flex-1 flex-col leading-[1.35]">
                        <span className="font-semibold">Wrap long values</span>
                        <span className="text-xs text-ink-2">
                          {prefs.wrap ? "On — long values wrap onto more lines" : "Off — values truncate, hover for the full text"}
                        </span>
                      </span>
                      <span
                        aria-hidden="true"
                        className={cn("relative h-5 w-[34px] flex-none rounded-full transition-colors duration-150", prefs.wrap ? "bg-brand" : "bg-line-2")}
                      >
                        <span
                          className={cn(
                            "absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,.2)] transition-transform duration-150 motion-reduce:transition-none",
                            prefs.wrap && "translate-x-[14px]"
                          )}
                        />
                      </span>
                    </button>
                  </>
                )}
              </Menu>
              </>
              )}
            </div>
          </div>

          {cards ? (
            <div className="rounded-b-card bg-surface-2 p-4">
              {loading ? (
                <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(${cardMinWidth}px, 100%), 1fr))` }}>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-56 rounded-card" />
                  ))}
                </div>
              ) : sorted.length === 0 ? (
                <div className="rounded-card bg-surface">{empty ?? <GridEmpty title="Nothing here yet" />}</div>
              ) : (
                <div role="list" aria-label={label} className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(${cardMinWidth}px, 100%), 1fr))` }}>
                  {renderCards
                    ? renderCards(sorted)
                    : sorted.map((row) => (
                        <div key={getRowId(row)} role="listitem" className="flex min-w-0 flex-col gap-3 rounded-card border border-line bg-surface p-4 shadow-card">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">{identity.render(row, display)}</div>
                            {action && <div className="flex flex-none items-center">{action.render(row, display)}</div>}
                          </div>
                          {visible.length > 0 && (
                            <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 rounded-ctl bg-surface-2 px-3 py-2.5">
                              {visible.map((c) => (
                                <div key={c.id} className="flex min-w-0 flex-col gap-0.5">
                                  <dt className="truncate text-[11px] font-medium text-ink-3">{c.label}</dt>
                                  <dd className="m-0 min-w-0 text-sm tabular-nums [&_*]:max-w-full">{c.render(row, display)}</dd>
                                </div>
                              ))}
                            </dl>
                          )}
                        </div>
                      ))}
                </div>
              )}
            </div>
          ) : (
          /* Grid — scrolls sideways inside the card. `relative` keeps sr-only text from widening the page. */
          <div className="relative overflow-x-auto overscroll-x-contain rounded-b-card">
            <div role="table" aria-label={label} aria-rowcount={loading ? undefined : rows.length + 1} className="w-full" style={{ minWidth }}>
              <div
                role="row"
                className={cn(rowBase, "min-h-[42px] border-b border-line bg-surface-2 text-xs font-medium text-ink-2")}
                style={rowStyle}
              >
                {headerCell(identity, true)}
                {visible.map((c) => headerCell(c))}
                {action && (
                  <div role="columnheader" className={cn(stickyCell, STICKY_SHADOW)}>
                    {action.label ?? "Action"}
                  </div>
                )}
              </div>

              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} role="row" className={cn(rowBase, "border-b border-line bg-surface")} style={{ ...rowStyle, minHeight: ROW_HEIGHT[prefs.density] }}>
                    <div role="cell" className="flex items-center gap-4 pl-4">
                      {selectable && <span className="h-[18px] w-[18px] flex-none" />}
                      <Skeleton className="h-3.5 w-[65%]" />
                    </div>
                    {visible.map((c) => (
                      <div key={c.id} role="cell" className={cn("flex", c.align === "right" && "justify-end")}>
                        <Skeleton className="h-3.5 w-[60%]" />
                      </div>
                    ))}
                    {action && <div role="cell" className={cn(stickyCell, STICKY_SHADOW)} />}
                  </div>
                ))
              ) : sorted.length === 0 ? (
                <div role="row">
                  <div role="cell">{empty ?? <GridEmpty title="Nothing here yet" />}</div>
                </div>
              ) : (
                sorted.map((row) => {
                  const id = getRowId(row);
                  const on = selected.has(id);
                  return (
                    <div
                      key={id}
                      role="row"
                      aria-selected={selectable ? on : undefined}
                      className={cn(rowBase, "border-b border-line transition-colors", on ? "bg-brand-soft" : "bg-surface hover:bg-surface-2")}
                      style={{ ...rowStyle, minHeight: ROW_HEIGHT[prefs.density] }}
                    >
                      <div role="cell" className={cn("flex min-w-0 items-center gap-4 pl-4", CELL_PAD[prefs.density])}>
                        {selectable && (
                          <Checkbox checked={on} onChange={() => toggleRow(id)} label={rowLabel ? rowLabel(row) : "Select row"} hideLabel />
                        )}
                        <div className="min-w-0 flex-1">{identity.render(row, display)}</div>
                      </div>
                      {visible.map((c) => (
                        <div
                          key={c.id}
                          role="cell"
                          className={cn("flex min-w-0 items-center tabular-nums", CELL_PAD[prefs.density], c.align === "right" && "justify-end text-right")}
                        >
                          {c.render(row, display)}
                        </div>
                      ))}
                      {action && (
                        <div role="cell" className={cn(stickyCell, STICKY_SHADOW)}>
                          {action.render(row, display)}
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {footerLabel !== undefined && !loading && sorted.length > 0 && (
                <div role="row" className={cn(rowBase, "min-h-[52px] bg-surface-2 tabular-nums")} style={rowStyle}>
                  <div role="cell" className="flex items-center gap-4 pl-4">
                    {selectable && <span className="w-[18px] flex-none" />}
                    <span className="whitespace-nowrap font-semibold">{footerLabel}</span>
                  </div>
                  {visible.map((c) => (
                    <div key={c.id} role="cell" className={cn("flex font-semibold", c.align === "right" && "justify-end text-right")}>
                      {c.footer}
                    </div>
                  ))}
                  {action && <div role="cell" className={cn(stickyCell, STICKY_SHADOW)} />}
                </div>
              )}
            </div>
          </div>
          )}
        </div>

        {/* Floating bulk bar: sticks to the viewport bottom (above the phone tab bar) while the grid is in view. */}
        {selectable && bulkActions && selCount > 0 && !cards && (
          <div
            role="toolbar"
            aria-label="Bulk actions"
            className="sticky bottom-[82px] z-30 mx-auto mt-3 flex max-w-full items-center gap-1 rounded-menu bg-ink py-1.5 pl-4 pr-1.5 text-surface shadow-pop animate-[adx-sheet-in_.18s_ease-out] motion-reduce:animate-none min-[900px]:bottom-5"
          >
            <span className="mr-2.5 flex-none whitespace-nowrap font-semibold tabular-nums" aria-live="polite">
              {selCount} selected
            </span>
            {/* Actions scroll on narrow screens; the count and ✕ stay put. */}
            <div className="flex min-w-0 gap-1 overflow-x-auto [scrollbar-width:none]">
              {bulkActions({ ids: Array.from(selected), rows: sorted.filter((r) => selected.has(getRowId(r))), clear: clearSel })}
            </div>
            <span className="mx-1 h-5 w-px flex-none bg-[color-mix(in_srgb,var(--surface)_25%,transparent)]" />
            <BulkButton aria-label="Clear selection" title="Clear selection" onClick={clearSel} className="flex w-[34px] flex-none items-center justify-center px-0">
              <X size={16} />
            </BulkButton>
          </div>
        )}
      </div>
    </DisplayContext.Provider>
  );
}
