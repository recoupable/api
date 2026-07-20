import { RECOUP_LOGO_URL, WEBSITE_URL } from "@/lib/const";
import { escapeHtml } from "@/lib/emails/escapeHtml";
import { formatCompactNumber } from "@/lib/emails/valuationReport/formatCompactNumber";

export type ValuationReportEmailParams = {
  catalogName: string | null;
  deepLinkUrl: string;
  albumCount: number;
  valuation?: { low: number; mid: number; high: number };
  totalStreams?: number;
  measuredSongCount?: number;
  catalogAgeYears?: number;
};

const SUBJECT = "Your catalog valuation is ready";

/**
 * Deterministic house-style renderer for the valuation-report email
 * (recoupable/chat#1867): the summary a signup can return to after closing
 * the tab. Styling follows DESIGN.md, mirroring the scrape-digest sibling —
 * achromatic chrome (#0a0a0a on #ffffff, #e8e8e8 borders, #6b6b6b muted),
 * tables + inline styles only, system font stack, fixed CHAT_APP_URL-based
 * deep link (never a derived deployment URL). Copy avoids em/en dashes and
 * uses "to" for the valuation range.
 */
export function renderValuationReportHtml(params: ValuationReportEmailParams): {
  subject: string;
  html: string;
} {
  const name = params.catalogName ? escapeHtml(params.catalogName) : "Your catalog";

  const valuationBlock = params.valuation
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8e8e8;border-radius:12px;margin:24px 0 0"><tr><td style="padding:20px 24px">
<p style="margin:0 0 4px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6b6b6b">Estimated value</p>
<p style="margin:0;font-size:36px;line-height:1.1;letter-spacing:-0.02em;font-weight:700;color:#0a0a0a">$${formatCompactNumber(params.valuation.mid)}</p>
<p style="margin:6px 0 0;font-size:13px;color:#6b6b6b">Range: $${formatCompactNumber(params.valuation.low)} to $${formatCompactNumber(params.valuation.high)}</p>
</td></tr></table>`
    : "";

  const statRows = [
    params.totalStreams != null
      ? ["Lifetime Spotify streams", formatCompactNumber(params.totalStreams)]
      : null,
    params.measuredSongCount != null
      ? ["Songs measured", formatCompactNumber(params.measuredSongCount)]
      : null,
    ["Albums measured", formatCompactNumber(params.albumCount)],
    params.catalogAgeYears != null
      ? ["Catalog age", `${params.catalogAgeYears} year${params.catalogAgeYears === 1 ? "" : "s"}`]
      : null,
  ]
    .filter((row): row is [string, string] => row !== null)
    .map(
      ([label, value]) =>
        `<tr><td style="padding:10px 0;border-bottom:1px solid #e8e8e8;font-size:14px;color:#6b6b6b">${label}</td><td align="right" style="padding:10px 0;border-bottom:1px solid #e8e8e8;font-size:14px;font-weight:600;color:#0a0a0a">${value}</td></tr>`,
    )
    .join("");

  const methodNote = params.valuation
    ? `<p style="margin:24px 0 0;font-size:12px;color:#6b6b6b">Estimate derived from lifetime Spotify play counts using a 10 to 16x net-royalty multiple. Not a formal appraisal.</p>`
    : "";

  const html = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7;padding:24px 0"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e8e8e8;border-radius:16px">
<tr><td style="padding:32px 32px 24px;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td valign="top">
<p style="margin:0 0 6px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6b6b6b">Catalog valuation</p>
<h1 style="margin:0 0 8px;font-size:26px;line-height:1.2;letter-spacing:-0.02em;color:#0a0a0a">${name}</h1>
<p style="margin:0;font-size:14px;color:#6b6b6b">Your measurement run is complete.</p>
</td>
<td valign="top" align="right" width="44"><a href="${WEBSITE_URL}"><img src="${RECOUP_LOGO_URL}" width="36" height="36" alt="Recoup" style="display:block;width:36px;height:36px;border-radius:8px"/></a></td>
</tr></table>
${valuationBlock}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0 0">${statRows}</table>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 0"><tr><td style="background:#0a0a0a;border-radius:8px"><a href="${params.deepLinkUrl}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none">View your full report &rarr;</a></td></tr></table>
${methodNote}
<p style="margin:24px 0 0;font-size:12px;color:#6b6b6b">You're receiving this because you ran a catalog valuation on Recoup.</p>
</td></tr></table>
</td></tr></table>`;

  return { subject: SUBJECT, html };
}
