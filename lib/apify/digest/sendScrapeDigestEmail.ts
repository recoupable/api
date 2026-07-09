import { sendEmailWithResend } from "@/lib/emails/sendEmail";
import { RECOUP_FROM_EMAIL } from "@/lib/const";
import { renderScrapeDigestHtml } from "@/lib/apify/digest/renderScrapeDigestHtml";
import type { ScrapeDigestSection } from "@/lib/apify/digest/renderScrapeDigestHtml";

export type ScrapeDigestInput = {
  emails: string[];
  sections: ScrapeDigestSection[];
  artistName?: string | null;
};

/**
 * Sends the consolidated new-posts digest: one email per scrape batch,
 * one section per platform that found genuinely new posts. Deterministic
 * body, direct links to each new post. Recipients span tenants — BCC only
 * (chat#1855).
 */
export async function sendScrapeDigestEmail({ emails, sections, artistName }: ScrapeDigestInput) {
  if (!emails.length || !sections.length) return null;

  const { subject, html } = renderScrapeDigestHtml({ sections, artistName });

  return await sendEmailWithResend({
    from: RECOUP_FROM_EMAIL,
    to: [RECOUP_FROM_EMAIL],
    bcc: emails,
    subject,
    html,
  });
}
