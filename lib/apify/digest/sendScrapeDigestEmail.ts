import { sendEmailWithResend } from "@/lib/emails/sendEmail";
import { RECOUP_FROM_EMAIL } from "@/lib/const";
import { renderScrapeDigestHtml } from "@/lib/apify/digest/renderScrapeDigestHtml";

export type ScrapeDigestSection = { platform: string; postUrls: string[] };
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

  const total = sections.reduce((n, s) => n + s.postUrls.length, 0);
  const who = artistName || "your artist";
  const sectionHtml = sections
    .map(
      s =>
        `<h3 style="margin:16px 0 4px">${s.platform}</h3><ul>${s.postUrls
          .map(u => `<li><a href="${u.startsWith("http") ? u : `https://${u}`}">${u}</a></li>`)
          .join("")}</ul>`,
    )
    .join("");

  return await sendEmailWithResend({
    from: RECOUP_FROM_EMAIL,
    to: [RECOUP_FROM_EMAIL],
    bcc: emails,
    subject: `${who}: ${total} new post${total === 1 ? "" : "s"} found across ${sections.length} platform${sections.length === 1 ? "" : "s"}`,
    html: `<p>New posts found for ${who}:</p>${sectionHtml}`,
  });
}
