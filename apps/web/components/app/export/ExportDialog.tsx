"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { cn } from "@/lib/cn";
import { Button, Dialog, Pill } from "@/components/app/ui";
import { downloadCsv, downloadXlsx, type ExportColumn, type ExportRow, type ExportSheet } from "./formats";

/**
 * D6 Export (plan A15), from Campaigns, Analytics and the Overview: CSV with
 * the rows as shown, or an Excel workbook whose sheets the page decides
 * (one per platform, a summary, …) with totals. Google Sheets is coming soon.
 */

type Format = "csv" | "xlsx";

export function ExportDialog({
  open,
  onClose,
  sub,
  filename,
  columns,
  rows,
  sheets,
  excelSub = "With totals and number formats",
}: {
  open: boolean;
  onClose: () => void;
  /** What's being exported, e.g. "15 campaigns · current filters and columns". */
  sub: string;
  /** Without extension. */
  filename: string;
  columns: ExportColumn[];
  /** The CSV rows (and the Excel sheet when `sheets` isn't given). */
  rows: ExportRow[];
  sheets?: ExportSheet[];
  excelSub?: string;
}) {
  const [format, setFormat] = useState<Format>("csv");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setBusy(false);
  }, [open]);

  const options: { id: Format | "sheets"; label: string; sub: string; soon?: boolean }[] = [
    { id: "csv", label: "CSV", sub: "Rows as shown, opens in Excel or Sheets" },
    { id: "xlsx", label: "Excel workbook", sub: excelSub },
    { id: "sheets", label: "Send to Google Sheets", sub: "Keeps updating every morning", soon: true },
  ];

  const download = async () => {
    setBusy(true);
    try {
      if (format === "csv") {
        downloadCsv(`${filename}.csv`, columns.map((c) => c.label), rows);
      } else {
        await downloadXlsx(`${filename}.xlsx`, sheets ?? [{ name: "Export", rows }], columns);
      }
      onClose();
    } catch {
      toast.error("Couldn't build the file. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Export"
      sub={sub}
      width={480}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void download()} loading={busy} disabled={rows.length === 0}>
            Download
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2" role="radiogroup" aria-label="Format">
        {options.map((o) => {
          const on = o.id === format;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={o.soon}
              onClick={() => o.id !== "sheets" && setFormat(o.id)}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors disabled:cursor-not-allowed",
                on ? "border-brand bg-brand-soft" : "border-line bg-surface enabled:hover:border-line-2",
                o.soon && "opacity-70"
              )}
            >
              <span className={cn("inline-flex h-4 w-4 flex-none items-center justify-center rounded-full border-[1.5px]", on ? "border-brand" : "border-line-2")} aria-hidden="true">
                {on && <span className="h-2 w-2 rounded-full bg-brand" />}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className={cn("text-sm font-semibold", on && "text-brand-ink")}>{o.label}</span>
                <span className="text-xs text-ink-2">{o.sub}</span>
              </span>
              {o.soon && <Pill tone="neutral">Coming soon</Pill>}
            </button>
          );
        })}
      </div>
    </Dialog>
  );
}
