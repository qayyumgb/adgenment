/** "$1,200" / "$12.50" in the account's currency (USD when unknown or invalid). */
export function money(n: number, currency: string | null | undefined): string {
  const whole = Math.abs(n - Math.round(n)) < 0.005;
  const opts = { style: "currency" as const, minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 };
  try {
    return new Intl.NumberFormat("en-US", { ...opts, currency: (currency ?? "USD").toUpperCase() }).format(n);
  } catch {
    return new Intl.NumberFormat("en-US", { ...opts, currency: "USD" }).format(n);
  }
}
