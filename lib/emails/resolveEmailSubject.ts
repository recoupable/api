/** Fallback subject when none is provided and the body has no usable first line. */
export const DEFAULT_EMAIL_SUBJECT = "Message from Recoup";

/** Max length for a subject derived from the body (full provided subjects pass through). */
const MAX_DERIVED_SUBJECT_LENGTH = 120;

/** First non-empty line of a string, with any leading Markdown heading `#`s stripped. */
function firstMeaningfulLine(value?: string): string {
  if (!value) return "";
  for (const line of value.split("\n")) {
    const cleaned = line.replace(/^\s*#+\s*/, "").trim();
    if (cleaned) return cleaned;
  }
  return "";
}

/** Strip HTML tags, breaking at block boundaries so the first block stays on its own line. */
function stripHtml(html?: string): string {
  if (!html) return "";
  return html
    .replace(/<\/(h[1-6]|p|div|li|tr)\s*>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/**
 * Resolve the subject for an outbound email. Resend requires a non-empty
 * subject, but `POST /api/emails` lets the caller omit it (recoupable/chat#1815):
 * use the provided subject when present, else derive one from the body's first
 * heading/line (text preferred, then HTML), else fall back to a generic default.
 * Mirrors the documented contract in docs#252.
 */
export function resolveEmailSubject({
  subject,
  text,
  html,
}: {
  subject?: string;
  text?: string;
  html?: string;
}): string {
  const provided = subject?.trim();
  if (provided) return provided;

  const derived = firstMeaningfulLine(text) || firstMeaningfulLine(stripHtml(html));
  if (derived) return derived.slice(0, MAX_DERIVED_SUBJECT_LENGTH);

  return DEFAULT_EMAIL_SUBJECT;
}
