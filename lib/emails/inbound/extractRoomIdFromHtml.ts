const UUID_PATTERN = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

// Matches chat.recoupable.com or chat.recoupable.dev /chat/{uuid} in various formats.
// Both hosts are recognized so legacy .com links still in flight resolve alongside
// post-migration .dev links:
// - Direct URL: https://chat.recoupable.dev/chat/uuid
// - URL-encoded (in tracking redirects): chat.recoupable.dev%2Fchat%2Fuuid
const CHAT_LINK_PATTERNS = [
  new RegExp(`https?://chat\\.recoupable\\.(com|dev)/chat/(${UUID_PATTERN})`, "i"),
  new RegExp(`chat\\.recoupable\\.(com|dev)%2Fchat%2F(${UUID_PATTERN})`, "i"),
];

// Pattern to find UUID after /chat/ or %2Fchat%2F in link text that may contain <wbr /> tags
// The link text version: "https://<wbr />/<wbr />chat.<wbr />recoupable.<wbr />dev/<wbr />chat/<wbr />uuid"
const WBR_STRIPPED_PATTERN = new RegExp(
  `chat\\.recoupable\\.(com|dev)/chat/(${UUID_PATTERN})`,
  "i",
);

/**
 * Extracts the roomId from email HTML by looking for a Recoup chat link.
 * Handles various formats including:
 * - Direct URLs in href attributes
 * - URL-encoded URLs in tracking redirect links
 * - Link text with <wbr /> tags inserted for word breaking (common in Superhuman)
 *
 * @param html - The email HTML body
 * @returns The roomId if found, undefined otherwise
 */
export function extractRoomIdFromHtml(html: string | undefined): string | undefined {
  if (!html) return undefined;

  // Try direct URL patterns first (most common case).
  // Group 1 is the host suffix (com|dev); group 2 is the UUID.
  for (const pattern of CHAT_LINK_PATTERNS) {
    const match = html.match(pattern);
    if (match?.[2]) {
      return match[2];
    }
  }

  // Fallback: strip <wbr /> tags and try again
  // This handles Superhuman's link text formatting: "https:/<wbr />/<wbr />chat.<wbr />..."
  const strippedHtml = html.replace(/<wbr\s*\/?>/gi, "");
  const strippedMatch = strippedHtml.match(WBR_STRIPPED_PATTERN);
  if (strippedMatch?.[2]) {
    return strippedMatch[2];
  }

  return undefined;
}
