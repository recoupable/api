import { formatCompactNumber } from "@/lib/emails/valuationReport/formatCompactNumber";

/**
 * Format a dollar amount for the valuation email as a compact string (e.g.
 * `$3.6M`). Shared by the valuation block and per-release rows so both surfaces
 * render money identically.
 */
export function formatUsd(n: number): string {
  return `$${formatCompactNumber(n)}`;
}
