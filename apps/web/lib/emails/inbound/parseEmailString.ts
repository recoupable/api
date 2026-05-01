const EMAIL_IN_ANGLE_BRACKETS = /<([^>]+@[^>]+)>/;
const BARE_EMAIL = /[^\s<>"',]+@[^\s<>"',]+/;

/**
 * Extracts a bare email address from a raw header value such as
 * `"Name" <user@example.com>` or a plain `user@example.com`.
 * Returns null when no email is found.
 */
export function parseEmailString(value: string): string | null {
  const angled = value.match(EMAIL_IN_ANGLE_BRACKETS)?.[1]?.trim();
  if (angled) return angled;
  const bare = value.match(BARE_EMAIL)?.[0]?.trim();
  return bare || null;
}
