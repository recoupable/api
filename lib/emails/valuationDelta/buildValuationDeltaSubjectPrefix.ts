import { formatCompactUsd } from "@/lib/emails/valuationReport/formatCompactUsd";
import type { CatalogValuationDelta } from "@/lib/catalog/getCatalogValuationDelta";

/**
 * The subject-line prefix for a delta-led report email (chat#1911 row 5):
 * `$1.1M (+10.0%) · ` when a previous measurement exists, `$1.1M baseline · `
 * for a first measurement, and just the value when the previous mid was zero
 * (a percent against zero is noise). The subject leading with the number is
 * the whole point — it is the line that gets the report opened.
 */
export function buildValuationDeltaSubjectPrefix(delta: CatalogValuationDelta): string {
  const value = formatCompactUsd(delta.current.mid);
  if (!delta.previous) return `${value} baseline · `;
  if (delta.previous.mid <= 0) return `${value} · `;

  const pct = ((delta.current.mid - delta.previous.mid) / delta.previous.mid) * 100;
  const signed = `${pct >= 0 ? "+" : "-"}${Math.abs(pct).toFixed(1)}%`;
  return `${value} (${signed}) · `;
}
