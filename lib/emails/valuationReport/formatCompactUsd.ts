import { formatCompactNumber } from "@/lib/emails/valuationReport/formatCompactNumber";

/**
 * Format a whole-dollar amount as a compact dollar string for the valuation
 * email, e.g. 3_569_477 → `$3.6M`. Distinct from `lib/stripe/formatUsd` (which
 * takes cents and renders exact `$99.00` for billing) — this one takes dollars
 * and compacts, for the large headline / per-release figures. Shared by the
 * valuation block and per-release rows so both render money identically.
 */
export function formatCompactUsd(n: number): string {
  return `$${formatCompactNumber(n)}`;
}
