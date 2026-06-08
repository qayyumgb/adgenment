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
  const maxFractionDigits = options.full ? 2 : 0;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      maximumFractionDigits: maxFractionDigits,
      notation: options.compact ? "compact" : "standard",
    }).format(n);
  } catch {
    // Unknown ISO code — fall back to plain "$1,234"
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: maxFractionDigits,
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
