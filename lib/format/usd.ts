/**
 * Format a number as a whole-dollar USD string, e.g. 54_600_000 → "$54,600,000".
 * Used in the valuation lead's Telegram ping + Attio note (chat#1885). Distinct
 * from `lib/emails/valuationReport/formatCompactUsd` (which compacts to "$54.6M"
 * for the email) and `lib/stripe/formatUsd` (which takes cents, for billing).
 */
export function usd(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}
