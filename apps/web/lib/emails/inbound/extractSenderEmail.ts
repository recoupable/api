import { parseEmailString } from "./parseEmailString";
import { readHeader } from "./readHeader";

/**
 * Resolves the true sender email address for an inbound Resend email.
 *
 * Prefers the raw `From:` header (which survives envelope rewrites from
 * Google Groups / alias forwarders), then `reply_to`, and finally the
 * envelope `from` as a last resort.
 */
export function extractSenderEmail(params: {
  headers: Record<string, string>;
  replyTo: string[] | null;
  envelopeFrom: string;
}): string {
  const headerFrom = readHeader(params.headers, "from");
  if (headerFrom) {
    const parsed = parseEmailString(headerFrom);
    if (parsed) return parsed;
  }

  const replyTo = params.replyTo?.[0];
  if (replyTo) {
    const parsed = parseEmailString(replyTo);
    if (parsed) return parsed;
  }

  return params.envelopeFrom;
}
