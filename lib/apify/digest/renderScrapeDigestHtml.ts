import { CHAT_APP_URL, RECOUP_LOGO_URL, WEBSITE_URL } from "@/lib/const";
import { escapeHtml } from "@/lib/emails/escapeHtml";
import { formatUtcDateLabel } from "@/lib/apify/digest/formatUtcDateLabel";
import { formatPostStats } from "@/lib/apify/digest/formatPostStats";
import { getPlatformLabel } from "@/lib/apify/digest/getPlatformLabel";
import { truncateText } from "@/lib/apify/digest/truncateText";

export type ScrapeDigestPostStats = {
  likes?: number | null;
  comments?: number | null;
  views?: number | null;
  shares?: number | null;
};

export type ScrapeDigestPost = {
  url: string;
  caption?: string | null;
  thumbnailUrl?: string | null;
  timestamp?: string | null;
  stats?: ScrapeDigestPostStats | null;
};

export type ScrapeDigestSection = { platform: string; posts: ScrapeDigestPost[] };

/**
 * Deterministic house-style renderer for the new-posts digest (chat#1855).
 * Replaces the per-send LLM body: identical input renders identical output,
 * every genuinely-new post is a linked card with its media, caption, and
 * engagement stats, and internal vendor jargon never reaches customers.
 * Styling follows DESIGN.md — achromatic chrome (#0a0a0a on #ffffff, #e8e8e8
 * borders, #6b6b6b muted); color comes from the post media, not the chrome.
 * Email-safe: tables + inline styles only, system font stack. The CTA is the
 * fixed CHAT_APP_URL — never a derived deployment URL (previews would point
 * customers at the API deployment itself).
 */
export function renderScrapeDigestHtml({
  sections,
  artistName,
}: {
  sections: ScrapeDigestSection[];
  artistName?: string | null;
}): { subject: string; html: string } {
  const who = artistName || "Your artist";
  const total = sections.reduce((n, s) => n + s.posts.length, 0);
  const subject = `${who}: ${total} new post${total === 1 ? "" : "s"} across ${sections.length} platform${sections.length === 1 ? "" : "s"}`;

  const sectionHtml = sections
    .map(section => {
      const cards = section.posts
        .map(post => {
          const href = post.url.startsWith("http") ? post.url : `https://${post.url}`;
          const caption = post.caption ? escapeHtml(truncateText(post.caption, 110)) : "";
          const date = post.timestamp ? formatUtcDateLabel(post.timestamp) : "";
          const stats = post.stats ? formatPostStats(post.stats) : "";
          const thumbCell = post.thumbnailUrl
            ? `<td width="72" valign="top" style="padding:0 14px 0 0"><a href="${href}"><img src="${post.thumbnailUrl}" width="72" height="72" alt="" style="display:block;width:72px;height:72px;object-fit:cover;border-radius:10px;border:1px solid #e8e8e8"/></a></td>`
            : "";
          return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8e8e8;border-radius:12px;margin:0 0 10px"><tr><td style="padding:14px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${thumbCell}<td valign="top">${caption ? `<p style="margin:0 0 6px;font-size:14px;line-height:1.45;color:#0a0a0a">${caption}</p>` : ""}${stats ? `<p style="margin:0 0 6px;font-size:12px;color:#6b6b6b">${stats}</p>` : ""}<p style="margin:0;font-size:13px">${date ? `<span style="color:#6b6b6b">${date} · </span>` : ""}<a href="${href}" style="color:#0a0a0a;font-weight:600;text-decoration:underline">View post →</a></p></td></tr></table></td></tr></table>`;
        })
        .join("");
      return `<p style="margin:28px 0 10px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6b6b6b">${getPlatformLabel(section.platform)}</p>${cards}`;
    })
    .join("");

  const chatUrl = `${CHAT_APP_URL}/?q=${encodeURIComponent("tell me about my artist's latest posts")}`;
  const html = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7;padding:24px 0"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e8e8e8;border-radius:16px">
<tr><td style="padding:32px 32px 24px;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td valign="top">
<p style="margin:0 0 6px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6b6b6b">New posts</p>
<h1 style="margin:0 0 8px;font-size:26px;line-height:1.2;letter-spacing:-0.02em;color:#0a0a0a">${escapeHtml(who)}</h1>
<p style="margin:0;font-size:14px;color:#6b6b6b">${total} new post${total === 1 ? "" : "s"} since we last checked</p>
</td>
<td valign="top" align="right" width="44"><a href="${WEBSITE_URL}"><img src="${RECOUP_LOGO_URL}" width="36" height="36" alt="Recoup" style="display:block;width:36px;height:36px;border-radius:8px"/></a></td>
</tr></table>
${sectionHtml}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 0"><tr><td style="background:#0a0a0a;border-radius:8px"><a href="${chatUrl}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none">Ask Recoup about these posts →</a></td></tr></table>
<p style="margin:24px 0 0;font-size:12px;color:#6b6b6b">You're receiving this because ${artistName ? escapeHtml(artistName) : "this artist"} is in your roster on Recoup.</p>
</td></tr></table>
</td></tr></table>`;

  return { subject, html };
}
