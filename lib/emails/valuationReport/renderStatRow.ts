import { formatCompactNumber } from "@/lib/emails/valuationReport/formatCompactNumber";
import type { ValuationReportEmailParams } from "@/lib/emails/valuationReport/valuationReportTypes";

/**
 * Render the measured-scope stat strip (lifetime streams, tracks measured,
 * releases, catalog age).
 */
export function renderStatRow(params: ValuationReportEmailParams): string {
  const stats: [string, string][] = [
    ["Lifetime streams", formatCompactNumber(params.totalStreams)],
    ["Tracks measured", formatCompactNumber(params.measuredSongCount)],
    ["Releases", formatCompactNumber(params.releaseCount ?? params.albumCount)],
    ["Catalog age", `${params.catalogAgeYears} year${params.catalogAgeYears === 1 ? "" : "s"}`],
  ];

  const cells = stats
    .map(
      ([label, value]) =>
        `<td valign="top" style="padding:0 8px 0 0"><p style="margin:0;font-size:18px;font-weight:700;color:#0a0a0a">${value}</p><p style="margin:2px 0 0;font-size:12px;color:#6b6b6b">${label}</p></td>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px"><tr>${cells}</tr></table>`;
}
