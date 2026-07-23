import { RECOUP_LOGO_URL, WEBSITE_URL } from "@/lib/const";
import { escapeHtml } from "@/lib/emails/escapeHtml";
import { renderArtistHeader } from "@/lib/emails/valuationReport/renderArtistHeader";
import { renderValuationBlock } from "@/lib/emails/valuationReport/renderValuationBlock";
import { renderStatRow } from "@/lib/emails/valuationReport/renderStatRow";
import { renderReleasesTable } from "@/lib/emails/valuationReport/renderReleasesTable";
import type { ValuationReportEmailParams } from "@/lib/emails/valuationReport/valuationReportTypes";

const SUBJECT = "Your catalog valuation is ready";
const FONT = "ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif";

/**
 * Deterministic house-style renderer for the valuation-report email
 * (recoupable/chat#1867, enriched per chat#1881): reproduces the marketing /
 * chat catalog-report result so the email reinforces the same numbers a signup
 * already saw — artist header, estimated value band, measured-scope stats, and
 * a per-release table with album art + proportional-share value. Styling
 * follows DESIGN.md: achromatic chrome (#0a0a0a on #ffffff, #e8e8e8 borders,
 * #6b6b6b muted), tables + inline styles only, system font stack, fixed
 * CHAT_APP_URL-based deep link (never a derived deployment URL). Copy avoids
 * em/en dashes and uses "to" for ranges. Per-album value is a proportional
 * share of the single headline band (value = mid x streams/total), so the rows
 * sum to the headline and never diverge from the funnel.
 */
export function renderValuationReportHtml(params: ValuationReportEmailParams): {
  subject: string;
  html: string;
} {
  const name = params.catalogName ? escapeHtml(params.catalogName) : "Your catalog";

  const disclaimer = params.valuation
    ? `<p style="margin:0 0 24px;font-size:12px;line-height:1.5;color:#6b6b6b">Directional model, not an appraisal. Based on live Spotify play counts measured today, an annual run-rate from your catalog's lifetime average, and a master-side net royalty share times a 10 to 16x market multiple. Real statements collapse the range.</p>`
    : "";

  const html = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7;padding:24px 0"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e8e8e8;border-radius:16px">
<tr><td style="padding:32px 32px 24px;font-family:${FONT}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px"><tr>
<td valign="top">
<p style="margin:0 0 6px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6b6b6b">Catalog valuation</p>
<h1 style="margin:0;font-size:24px;line-height:1.2;letter-spacing:-0.02em;color:#0a0a0a">${name}</h1>
</td>
<td valign="top" align="right" width="44"><a href="${WEBSITE_URL}"><img src="${RECOUP_LOGO_URL}" width="36" height="36" alt="Recoup" style="display:block;width:36px;height:36px;border-radius:8px"/></a></td>
</tr></table>
${renderArtistHeader(params.artist)}
${renderValuationBlock(params.valuation)}
${renderStatRow(params)}
${renderReleasesTable(params.releases)}
${disclaimer}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 8px"><tr><td style="background:#0a0a0a;border-radius:8px"><a href="${params.deepLinkUrl}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none">Get the full report with Recoup &rarr;</a></td></tr></table>
<p style="margin:20px 0 0;font-size:12px;color:#6b6b6b">You're receiving this because you ran a catalog valuation on Recoup.</p>
</td></tr></table>
</td></tr></table>`;

  return { subject: SUBJECT, html };
}
