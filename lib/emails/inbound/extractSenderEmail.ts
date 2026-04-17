const EMAIL_IN_ANGLE_BRACKETS = /<([^>]+)>/;
const BARE_EMAIL = /[^\s<>"',]+@[^\s<>"',]+/;

function parseEmailString(value: string): string | null {
  const angled = value.match(EMAIL_IN_ANGLE_BRACKETS)?.[1]?.trim();
  if (angled) return angled;
  const bare = value.match(BARE_EMAIL)?.[0]?.trim();
  return bare || null;
}

function readHeader(headers: Record<string, string>, name: string): string | undefined {
  const lowerName = name.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === lowerName) return headers[key];
  }
  return undefined;
}

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
  if (replyTo) return replyTo;

  return params.envelopeFrom;
}
