/**
 * Returns true if the given string is a valid IANA time zone identifier
 * (e.g. "America/New_York"), as recognized by the runtime's Intl database.
 *
 * @param timeZone - The candidate IANA time zone identifier.
 * @returns Whether the identifier is a valid IANA time zone.
 */
export function isValidTimeZone(timeZone: string): boolean {
  if (typeof timeZone !== "string" || timeZone.length === 0) {
    return false;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}
