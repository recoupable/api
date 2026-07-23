import { RECOUP_LOGO_URL, WEBSITE_URL } from "@/lib/const";
import { escapeHtml } from "@/lib/emails/escapeHtml";
import { formatCompactNumber } from "@/lib/emails/valuationReport/formatCompactNumber";

export type ValuationReleaseRow = {
  album: string | null;
  artistNames: string[];
  streams: number;
  /** Proportional share of the band's central value (streams / totalStreams x mid). */
  value: number;
  artUrl: string | null;
};

export type ValuationReportEmailParams = {
  catalogName: string | null;
  deepLinkUrl: string;
  albumCount: number;
  artist?: { name: string | null; imageUrl: string | null; followers: number | null };
  valuation?: { low: number; mid: number; high: number };
  totalStreams?: number;
  measuredSongCount?: number;
  releaseCount?: number;
  catalogAgeYears?: number;
  releases?: ValuationReleaseRow[];
};

const SUBJECT = "Your catalog valuation is ready";
const FONT = "ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif";

const usd = (n: number) => `$${formatCompactNumber(n)}`;

function renderArtistHeader(artist: ValuationReportEmailParams["artist"]): string {
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

function renderValuationBlock(valuation: ValuationReportEmailParams["valuation"]): string {
  if (!valuation) return "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8e8e8;border-radius:12px;margin:0 0 20px"><tr><td style="padding:20px 24px">
<p style="margin:0 0 4px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6b6b6b">Estimated catalog value</p>
<p style="margin:0;font-size:38px;line-height:1.1;letter-spacing:-0.02em;font-weight:700;color:#0a0a0a">${usd(valuation.mid)}</p>
<p style="margin:6px 0 0;font-size:13px;color:#6b6b6b">Range ${usd(valuation.low)} to ${usd(valuation.high)}</p>
</td></tr></table>`;
}

function renderStatRow(params: ValuationReportEmailParams): string {
  const stats = [
    params.totalStreams != null
      ? ["Lifetime streams", formatCompactNumber(params.totalStreams)]
      : null,
    params.measuredSongCount != null
      ? ["Tracks measured", formatCompactNumber(params.measuredSongCount)]
      : null,
    ["Releases", formatCompactNumber(params.releaseCount ?? params.albumCount)],
    params.catalogAgeYears != null
      ? ["Catalog age", `${params.catalogAgeYears} year${params.catalogAgeYears === 1 ? "" : "s"}`]
      : null,
  ].filter((s): s is [string, string] => s !== null);

  const cells = stats
    .map(
      ([label, value]) =>
        `<td valign="top" style="padding:0 8px 0 0"><p style="margin:0;font-size:18px;font-weight:700;color:#0a0a0a">${value}</p><p style="margin:2px 0 0;font-size:12px;color:#6b6b6b">${label}</p></td>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px"><tr>${cells}</tr></table>`;
}

function renderReleaseRow(release: ValuationReleaseRow): string {
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
<td valign="middle" align="right" style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px;font-weight:700;color:#0a0a0a;white-space:nowrap">${usd(release.value)}</td>
</tr>`;
}

function renderReleasesTable(releases: ValuationReleaseRow[] | undefined): string {
  if (!releases || releases.length === 0) return "";
  const header = `<tr>
<td colspan="2" style="padding:0 0 8px;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#6b6b6b">Release</td>
<td align="right" style="padding:0 12px 8px 0;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#6b6b6b">Streams</td>
<td align="right" style="padding:0 0 8px;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#6b6b6b">Value</td>
</tr>`;
  const rows = releases.map(renderReleaseRow).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px">${header}${rows}</table>`;
}

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
