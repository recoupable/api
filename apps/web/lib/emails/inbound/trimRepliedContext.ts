/**
 * Trims replied/forwarded context from email HTML content.
 * Removes quote-related HTML elements and converts to plain text.
 *
 * @param html - The HTML email content that may contain replied context
 * @returns The trimmed plain text content
 */
export function trimRepliedContext(html: string): string {
  if (!html) {
    return html;
  }

  // Remove quote-related HTML elements (Gmail, Outlook, Apple Mail, etc.)
  let trimmed = html;

  // Remove Gmail quote containers
  trimmed = trimmed.replace(/<div[^>]*class="[^"]*gmail_quote[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "");

  // Remove blockquote elements (common in email replies)
  trimmed = trimmed.replace(/<blockquote[^>]*>[\s\S]*?<\/blockquote>/gi, "");

  // Remove Outlook quote markers
  trimmed = trimmed.replace(
    /<div[^>]*class="[^"]*OutlookMessageHeader[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
    "",
  );

  // Remove Apple Mail quote markers
  trimmed = trimmed.replace(
    /<div[^>]*class="[^"]*AppleMailSignature[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
    "",
  );

  // Remove any remaining quote-related divs
  trimmed = trimmed.replace(/<div[^>]*class="[^"]*quote[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "");

  // Strip HTML tags to get plain text
  trimmed = trimmed
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  return trimmed.trim();
}
