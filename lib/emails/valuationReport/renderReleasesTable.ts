import { renderReleaseRow } from "@/lib/emails/valuationReport/renderReleaseRow";
import type { ValuationReleaseRow } from "@/lib/emails/valuationReport/valuationReportTypes";

/**
 * Render the per-release table (header + one row per release). Returns "" when
 * there are no releases so the section collapses.
 */
export function renderReleasesTable(releases: ValuationReleaseRow[] | undefined): string {
  if (!releases || releases.length === 0) return "";
  const header = `<tr>
<td colspan="2" style="padding:0 0 8px;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#6b6b6b">Release</td>
<td align="right" style="padding:0 12px 8px 0;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#6b6b6b">Streams</td>
<td align="right" style="padding:0 0 8px;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#6b6b6b">Value</td>
</tr>`;
  const rows = releases.map(renderReleaseRow).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px">${header}${rows}</table>`;
}
