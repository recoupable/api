import { CHAT_APP_URL } from "@/lib/const";
import { getEmailFooter } from "@/lib/emails/getEmailFooter";
import { renderEmailLayout } from "@/lib/emails/renderEmailLayout";

/**
 * Nudge for an account that was welcomed but never added an artist (chat#1889).
 *
 * The welcome email fires on account creation regardless of whether a valuation
 * preceded it, so a cold-start signup was told to "confirm your artists" and
 * "see your baseline valuation" for records that do not exist. This email asks
 * for the one thing that unblocks everything else: pick the artist.
 *
 * Chrome comes from the shared `renderEmailLayout` (api#784). Copy avoids em/en
 * dashes.
 */
export function buildColdStartNudgeEmail(): { subject: string; html: string } {
  const bodyHtml = `<p style="margin:0 0 6px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6b6b6b">One step left</p>
<h1 style="margin:0 0 20px;font-size:24px;line-height:1.2;letter-spacing:-0.02em;color:#0a0a0a">Add an artist and we will value their catalog.</h1>
<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#0a0a0a">Your Recoup account is ready, but there is no artist on it yet, so there is nothing for us to measure. Search for the artist you manage and we will pull their catalog and estimate what it is worth.</p>
<p style="margin:0;font-size:14px;line-height:1.6;color:#6b6b6b">It takes one search. Everything else, the catalog, the valuation, and the weekly report, follows from it.</p>`;

  const html = renderEmailLayout({
    bodyHtml,
    cta: {
      label: "Add your artist &rarr;",
      url: `${CHAT_APP_URL}/setup/artists`,
    },
    footerHtml: getEmailFooter(),
  });

  return { subject: "Add an artist to see your catalog value", html };
}
