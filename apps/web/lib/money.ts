/**
 * Currency-aware money formatting. Uses Intl.NumberFormat so values render
 * with the correct symbol (₹, $, €) and the correct grouping convention
 * (1,00,000 vs 100,000) for the given currency.
 *
 * `currency` defaults to USD when undefined — happens before the AdAccount
 * row has been re-synced with the new schema, and on aggregate views that
 * span multiple ad accounts with mixed currencies.
 */
export function fmtMoney(
  n: number,
  currency: string | null | undefined,
  options: { full?: boolean; compact?: boolean } = {}
): string {
  const code = (currency ?? "USD").toUpperCase();
  // Money shows EXACT cents by default (e.g. spend "Rs1,148.72" must match the
  // ad platform to the cent — clients are sensitive about payment figures).
  // `compact` is for space-constrained hero numbers, where 1 decimal ("Rs1.1K")
  // is the readable choice. `full` is kept for back-compat (already 2 here).
  const fractionDigits = options.compact ? 1 : 2;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      minimumFractionDigits: options.compact ? 0 : 2,
      maximumFractionDigits: fractionDigits,
      notation: options.compact ? "compact" : "standard",
    }).format(n);
  } catch {
    // Unknown ISO code — fall back to plain "$1,234.56"
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: options.compact ? 0 : 2,
      maximumFractionDigits: fractionDigits,
      notation: options.compact ? "compact" : "standard",
    }).format(n);
  }
}

/** "₹" / "$" / etc — just the symbol, no value. Useful for input prefixes. */
export function currencySymbol(currency: string | null | undefined): string {
  const code = (currency ?? "USD").toUpperCase();
  try {
    const parts = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
    }).formatToParts(0);
    return parts.find((p) => p.type === "currency")?.value ?? "$";
  } catch {
    return "$";
  }
}
