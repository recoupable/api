/**
 * First non-empty line of a string, with any leading Markdown heading `#`s
 * stripped. Returns "" when there is no meaningful line.
 *
 * @param value - The string to scan (e.g. a Markdown/plain-text email body).
 */
export function firstMeaningfulLine(value?: string): string {
  if (!value) return "";
  for (const line of value.split("\n")) {
    const cleaned = line.replace(/^\s*#+\s*/, "").trim();
    if (cleaned) return cleaned;
  }
  return "";
}
