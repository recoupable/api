import { sendEmailWithResend } from "@/lib/emails/sendEmail";
import { RECOUP_FROM_EMAIL } from "@/lib/const";
import { renderScrapeDigestHtml } from "@/lib/apify/digest/renderScrapeDigestHtml";
import type { ApifyInstagramProfileResult } from "@/lib/apify/types";

/**
 * Sends the legacy single-platform Instagram alert (non-batch scrape runs).
 * Batch runs get the consolidated digest instead. Body comes from the shared
 * deterministic renderer — the per-send LLM body is gone (chat#1855): stable
 * branding, direct links to the new posts, no vendor jargon.
 *
 * @param profile - First dataset result from the profile scraper.
 * @param emails - Recipient email addresses (cross-tenant — BCC only).
 * @param newPostUrls - Post URLs genuinely new to the platform.
 * @returns The Resend response, or `null` when there is nothing to send.
 */
export async function sendApifyWebhookEmail(
  profile: ApifyInstagramProfileResult,
  emails: string[],
  newPostUrls: string[] = [],
) {
  if (!emails?.length || !newPostUrls.length) return null;

  const { subject, html } = renderScrapeDigestHtml({
    sections: [{ platform: "instagram", postUrls: newPostUrls }],
    artistName: profile.fullName ?? profile.username ?? null,
  });

  // Recipients span multiple customer accounts (the social's watchers are
  // resolved cross-tenant), so they must NEVER share a visible To: line —
  // BCC only, with ourselves as the required To: (chat#1855).
  return await sendEmailWithResend({
    from: RECOUP_FROM_EMAIL,
    to: [RECOUP_FROM_EMAIL],
    bcc: emails,
    subject,
    html,
  });
}
