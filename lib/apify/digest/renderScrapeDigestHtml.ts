import { getFrontendBaseUrl } from "@/lib/composio/getFrontendBaseUrl";
import type { ScrapeDigestSection } from "@/lib/apify/digest/sendScrapeDigestEmail";

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  x: "X",
  twitter: "X",
  youtube: "YouTube",
  facebook: "Facebook",
  threads: "Threads",
};

/**
 * Deterministic house-style renderer for the new-posts digest (chat#1855).
 * Replaces the per-send LLM body: identical input renders identical output,
 * every genuinely-new post is linked directly, and internal vendor jargon
 * never reaches customers.
 */
export function renderScrapeDigestHtml({
  sections,
  artistName,
}: {
  sections: ScrapeDigestSection[];
  artistName?: string | null;
}): { subject: string; html: string } {
  const who = artistName || "Your artist";
  const total = sections.reduce((n, s) => n + s.postUrls.length, 0);
  const subject = `${who}: ${total} new post${total === 1 ? "" : "s"} across ${sections.length} platform${sections.length === 1 ? "" : "s"}`;

  const sectionHtml = sections
    .map(section => {
      const label = PLATFORM_LABELS[section.platform.toLowerCase()] ?? section.platform;
      const items = section.postUrls
        .map(url => {
          const href = url.startsWith("http") ? url : `https://${url}`;
          return `<li style="margin:4px 0"><a href="${href}" style="color:#111;text-decoration:underline">${href}</a></li>`;
        })
        .join("");
      return `<h3 style="margin:20px 0 6px;font-size:15px">${label}</h3><ul style="margin:0;padding-left:20px">${items}</ul>`;
    })
    .join("");

  const chatUrl = `${getFrontendBaseUrl()}/?q=${encodeURIComponent("tell me about my artist's latest posts")}`;
  const html = `<div style="font-family:ui-sans-serif,system-ui,sans-serif;color:#111;max-width:560px">
<h2 style="font-size:18px;margin:0 0 8px">New posts from ${who}</h2>
<p style="margin:0 0 4px">We found ${total} new post${total === 1 ? "" : "s"} since we last checked:</p>
${sectionHtml}
<p style="margin:24px 0 0"><a href="${chatUrl}" style="color:#111">Ask Recoup about these posts →</a></p>
</div>`;

  return { subject, html };
}
