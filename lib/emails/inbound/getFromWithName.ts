import { RECOUP_EMAIL_DOMAIN } from "@/lib/const";

/**
 * Gets a formatted "from" email address with a human-readable name.
 *
 * @param toEmails - Array of email addresses from the 'to' field
 * @param ccEmails - Optional array of email addresses from the 'cc' field (fallback)
 * @returns Formatted email address with display name (e.g., "Support <support@mail.recoupable.com>")
 * @throws Error if no email ending with "@mail.recoupable.com" is found in either array
 */
export function getFromWithName(toEmails: string[], ccEmails: string[] = []): string {
  // Find the first email in the 'to' array that ends with "@mail.recoupable.com"
  let customFromEmail = toEmails.find(email => email.toLowerCase().endsWith(RECOUP_EMAIL_DOMAIN));

  // If not found in 'to', check the 'cc' array as fallback
  if (!customFromEmail) {
    customFromEmail = ccEmails.find(email => email.toLowerCase().endsWith(RECOUP_EMAIL_DOMAIN));
  }

  if (!customFromEmail) {
    throw new Error(`No email found ending with ${RECOUP_EMAIL_DOMAIN} in the 'to' or 'cc' array`);
  }

  // Extract the name part (everything before the @ sign) for a human-readable from name
  const emailNameRaw = customFromEmail.split("@")[0];
  const emailName = emailNameRaw.charAt(0).toUpperCase() + emailNameRaw.slice(1);
  return `${emailName} <${customFromEmail}>`;
}
