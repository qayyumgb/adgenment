/** Client-side CSV download (plan A5; the D6 export dialog comes later). */

const cell = (v: string | number | null | undefined) => {
  if (v === null || v === undefined) return "";
  const s = String(v);
  // Quote when needed; neutralise spreadsheet formula injection (=, +, -, @).
  const safe = /^[=+\-@]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function downloadCsv(filename: string, header: string[], rows: (string | number | null | undefined)[][]) {
  const text = [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
  // BOM so Excel opens UTF-8 names (₹, é, emoji) correctly.
  const blob = new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
