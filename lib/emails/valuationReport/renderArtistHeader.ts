import { escapeHtml } from "@/lib/emails/escapeHtml";
import { formatCompactNumber } from "@/lib/emails/valuationReport/formatCompactNumber";
import type { ValuationReportEmailParams } from "@/lib/emails/valuationReport/valuationReportTypes";

/**
 * Render the artist header (avatar + name + follower count) for the valuation
 * email. Returns "" when no named artist is present so the section collapses.
 */
export function renderArtistHeader(artist: ValuationReportEmailParams["artist"]): string {
  if (!artist || !artist.name) return "";
  const name = escapeHtml(artist.name);
  const followers =
    artist.followers != null
      ? `<p style="margin:2px 0 0;font-size:13px;color:#6b6b6b">${formatCompactNumber(artist.followers)} followers</p>`
      : "";
  const avatar = artist.imageUrl
    ? `<td valign="middle" width="56" style="padding-right:14px"><img src="${escapeHtml(artist.imageUrl)}" width="56" height="56" alt="${name}" style="display:block;width:56px;height:56px;border-radius:50%;object-fit:cover"/></td>`
    : "";
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px"><tr>
${avatar}
<td valign="middle"><p style="margin:0;font-size:20px;font-weight:700;letter-spacing:-0.01em;color:#0a0a0a">${name}</p>${followers}</td>
</tr></table>`;
}
