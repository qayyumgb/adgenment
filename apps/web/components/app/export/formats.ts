/**
 * Export formats for the D6 dialog (plan A15): CSV (rows as shown) and an
 * Excel workbook (sheets with totals and number formats), both built in the
 * browser. The Excel writer is loaded only when someone downloads a workbook.
 */

export type ExportCell = string | number | null | undefined;
export type ExportRow = ExportCell[];

export interface ExportColumn {
  label: string;
  /** money / int / decimal / pct get number formats in Excel; currency marks the row's currency code. */
  kind?: "text" | "currency" | "money" | "int" | "decimal" | "pct";
  /**
   * Totals row in Excel: "sum", or a function of the summed columns (by
   * index) for ratios such as ROAS. Totals that involve money are left blank
   * when a sheet mixes currencies.
   */
  total?: "sum" | ((sum: (col: number) => number) => number | null);
  /** A computed total that uses money columns (ROAS, CPA, CPM). Money columns count automatically. */
  money?: boolean;
  width?: number;
}

export interface ExportSheet {
  name: string;
  rows: ExportRow[];
  /** Defaults to the export's columns. */
  columns?: ExportColumn[];
  /** Off for sheets that aren't lists (a KPI summary). */
  totals?: boolean;
}

/** Two decimals, as a number (exports keep numbers numeric for Excel). */
export const r2 = (n: number) => Math.round(n * 100) / 100;
/** a / b, or null when b is 0. */
export const ratio = (a: number, b: number, scale = 1) => (b > 0 ? r2((a / b) * scale) : null);

const cell = (v: ExportCell) => {
  if (v === null || v === undefined) return "";
  const s = String(v);
  // Quote when needed; neutralise spreadsheet formula injection (=, +, -, @).
  const safe = /^[=+\-@]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadCsv(filename: string, header: string[], rows: ExportRow[]) {
  const text = [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
  // BOM so Excel opens UTF-8 names (₹, é, emoji) correctly.
  save(new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" }), filename);
}

const FORMAT: Partial<Record<NonNullable<ExportColumn["kind"]>, string>> = { money: "#,##0.00", int: "#,##0", decimal: "0.00", pct: "0.00" };

/** Excel sheet names: 31 characters, none of : \ / ? * [ ], unique. */
function sheetNames(names: string[]) {
  const used = new Set<string>();
  return names.map((n) => {
    const base = (n.replace(/[:\\/?*[\]]/g, " ").trim() || "Sheet").slice(0, 31);
    let name = base;
    for (let i = 2; used.has(name.toLowerCase()); i++) name = `${base.slice(0, 31 - String(i).length - 1)} ${i}`;
    used.add(name.toLowerCase());
    return name;
  });
}

function totalsRow(columns: ExportColumn[], rows: ExportRow[]) {
  const cur = columns.findIndex((c) => c.kind === "currency");
  const currencies = cur < 0 ? [] : Array.from(new Set(rows.map((r) => r[cur]).filter((v): v is string => typeof v === "string" && v !== "")));
  const mixed = currencies.length > 1;
  const sum = (i: number) => rows.reduce((s, r) => s + (typeof r[i] === "number" ? (r[i] as number) : 0), 0);
  return columns.map((c, i) => {
    if (i === 0) return mixed ? `Total (mixed currencies: ${currencies.join(", ")})` : "Total";
    if (i === cur && !mixed) return currencies[0] ?? null;
    if (!c.total || (mixed && (c.kind === "money" || c.money))) return null;
    const v = c.total === "sum" ? sum(i) : c.total(sum);
    return v === null || !Number.isFinite(v) ? null : r2(v);
  });
}

export async function downloadXlsx(filename: string, sheets: ExportSheet[], columns: ExportColumn[]) {
  const { default: writeExcelFile } = await import("write-excel-file/browser");
  const names = sheetNames(sheets.map((s) => s.name));
  const out = sheets.map((s, si) => {
    const cols = s.columns ?? columns;
    const body = s.totals === false || s.rows.length === 0 ? s.rows : [...s.rows, totalsRow(cols, s.rows)];
    const last = body.length - 1;
    return {
      sheet: names[si],
      stickyRowsCount: 1,
      columns: cols.map((c) => ({ width: c.width ?? (c.kind === "text" || !c.kind ? 28 : 14) })),
      data: [
        cols.map((c) => ({ value: c.label, fontWeight: "bold" as const })),
        ...body.map((r, ri) =>
          cols.map((c, ci) => {
            const v = r[ci];
            const bold = s.totals !== false && s.rows.length > 0 && ri === last ? ("bold" as const) : undefined;
            if (typeof v === "number") return { value: v, type: Number, format: FORMAT[c.kind ?? "text"], fontWeight: bold };
            return v === null || v === undefined || v === "" ? null : { value: String(v), type: String, fontWeight: bold };
          })
        ),
      ],
    };
  });
  save(await writeExcelFile(out).toBlob(), filename);
}
