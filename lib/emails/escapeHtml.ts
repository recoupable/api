/**
 * Escapes text for safe interpolation into email/notification HTML, so
 * user- or scraper-supplied content can never inject markup.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
