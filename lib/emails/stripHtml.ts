/**
 * Strip HTML tags to plain text, breaking at block boundaries so the first
 * block stays on its own line (so callers can pull the first line/heading).
 *
 * @param html - The HTML string to flatten.
 */
export function stripHtml(html?: string): string {
  if (!html) return "";
  return html
    .replace(/<\/(h[1-6]|p|div|li|tr)\s*>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}
