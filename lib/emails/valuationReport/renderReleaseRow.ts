import { escapeHtml } from "@/lib/emails/escapeHtml";
import { formatCompactNumber } from "@/lib/emails/valuationReport/formatCompactNumber";
import { formatUsd } from "@/lib/emails/valuationReport/formatUsd";
import type { ValuationReleaseRow } from "@/lib/emails/valuationReport/valuationReportTypes";

/**
 * Render one row of the per-release table: album art thumbnail, title + artists,
 * streams, and proportional-share value. Falls back to a grey square when the
 * release has no cover art.
 */
export function renderReleaseRow(release: ValuationReleaseRow): string {
  const album = release.album ? escapeHtml(release.album) : "Untitled release";
  const artists = release.artistNames.length
    ? `<p style="margin:2px 0 0;font-size:12px;color:#6b6b6b">${escapeHtml(release.artistNames.join(", "))}</p>`
    : "";
  const art = release.artUrl
    ? `<img src="${escapeHtml(release.artUrl)}" width="40" height="40" alt="" style="display:block;width:40px;height:40px;border-radius:4px;object-fit:cover"/>`
    : `<div style="width:40px;height:40px;border-radius:4px;background:#f0f0f0"></div>`;
  return `<tr>
<td valign="middle" width="40" style="padding:10px 12px 10px 0;border-bottom:1px solid #f0f0f0">${art}</td>
<td valign="middle" style="padding:10px 12px 10px 0;border-bottom:1px solid #f0f0f0"><p style="margin:0;font-size:14px;font-weight:600;color:#0a0a0a">${album}</p>${artists}</td>
<td valign="middle" align="right" style="padding:10px 12px 10px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:#6b6b6b;white-space:nowrap">${formatCompactNumber(release.streams)}</td>
<td valign="middle" align="right" style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px;font-weight:700;color:#0a0a0a;white-space:nowrap">${formatUsd(release.value)}</td>
</tr>`;
}
