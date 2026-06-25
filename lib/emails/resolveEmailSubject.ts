import { firstMeaningfulLine } from "@/lib/emails/firstMeaningfulLine";
import { stripHtml } from "@/lib/emails/stripHtml";

/** Fallback subject when none is provided and the body has no usable first line. */
export const DEFAULT_EMAIL_SUBJECT = "Message from Recoup";

/** Max length for a subject derived from the body (full provided subjects pass through). */
const MAX_DERIVED_SUBJECT_LENGTH = 120;

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
