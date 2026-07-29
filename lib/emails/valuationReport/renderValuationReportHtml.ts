import { escapeHtml } from "@/lib/emails/escapeHtml";
import { renderEmailLayout } from "@/lib/emails/renderEmailLayout";
import { renderArtistHeader } from "@/lib/emails/valuationReport/renderArtistHeader";
import { renderValuationBlock } from "@/lib/emails/valuationReport/renderValuationBlock";
import { renderStatRow } from "@/lib/emails/valuationReport/renderStatRow";
import { renderReleasesTable } from "@/lib/emails/valuationReport/renderReleasesTable";
import type { ValuationReportEmailParams } from "@/lib/emails/valuationReport/valuationReportTypes";

const SUBJECT = "Your catalog valuation is ready";

/**
 * Deterministic house-style renderer for the valuation-report email
 * (recoupable/chat#1867, enriched per chat#1881): reproduces the marketing /
 * chat catalog-report result so the email reinforces the same numbers a signup
 * already saw — artist header, estimated value band, measured-scope stats, and
 * a per-release table with album art + proportional-share value.
 *
 * Chrome comes from the shared `renderEmailLayout` wrapper (consistency pass,
 * chat#1885) — the same header / card / CTA / footer every automated email
 * uses — so this renderer only owns its body content, CTA target, and footer
 * note. Deep link is the fixed CHAT_APP_URL (never a derived deployment URL).
 * Copy avoids
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

  const bodyHtml = `<p style="margin:0 0 6px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6b6b6b">Catalog valuation</p>
<h1 style="margin:0 0 20px;font-size:24px;line-height:1.2;letter-spacing:-0.02em;color:#0a0a0a">${name}</h1>
${renderArtistHeader(params.artist)}
${renderValuationBlock(params.valuation)}
${renderStatRow(params)}
${renderReleasesTable(params.releases)}
${disclaimer}`;

  const html = renderEmailLayout({
    bodyHtml,
    cta: {
      label: "Get the full report with Recoup &rarr;",
      url: params.deepLinkUrl,
    },
    footerHtml: `<p style="margin:0;font-size:12px;color:#6b6b6b">You're receiving this because you ran a catalog valuation on Recoup.</p>`,
  });

  return { subject: SUBJECT, html };
}
