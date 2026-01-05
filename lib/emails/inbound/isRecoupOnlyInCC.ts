/**
 * Checks if a Recoup email address is only in the CC array (not in the TO array).
 *
 * @param to - Array of email addresses in the TO field
 * @param cc - Array of email addresses in the CC field
 * @returns true if a Recoup email is in CC but not in TO, false otherwise
 */
export function isRecoupOnlyInCC(to: string[], cc: string[]): boolean {
  const recoupDomain = "@mail.recoupable.com";

  const hasRecoupInTo = to.some(email => email.toLowerCase().endsWith(recoupDomain));

  const hasRecoupInCC = cc.some(email => email.toLowerCase().endsWith(recoupDomain));

  return hasRecoupInCC && !hasRecoupInTo;
}
