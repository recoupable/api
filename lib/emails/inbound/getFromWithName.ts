import { OUTBOUND_EMAIL_DOMAIN, INBOUND_EMAIL_DOMAIN } from "@/lib/const";

/**
 * Gets a formatted "from" email address with a human-readable name.
 * Finds the inbound email address and converts it to the outbound domain for sending.
 *
 * @param toEmails - Array of email addresses from the 'to' field
 * @param ccEmails - Optional array of email addresses from the 'cc' field (fallback)
 * @returns Formatted email address with display name (e.g., "Support by Recoup <support@recoupable.com>")
 * @throws Error if no email ending with the inbound domain is found in either array
 */
export function getFromWithName(toEmails: string[], ccEmails: string[] = []): string {
  // Find the first email in the 'to' array that ends with the inbound domain
  let inboundEmail = toEmails.find(email => email.toLowerCase().endsWith(INBOUND_EMAIL_DOMAIN));

  // If not found in 'to', check the 'cc' array as fallback
  if (!inboundEmail) {
    inboundEmail = ccEmails.find(email => email.toLowerCase().endsWith(INBOUND_EMAIL_DOMAIN));
  }

  if (!inboundEmail) {
    throw new Error(`No email found ending with ${INBOUND_EMAIL_DOMAIN} in the 'to' or 'cc' array`);
  }

  // Extract the name part (everything before the @ sign) for a human-readable from name
  const emailNameRaw = inboundEmail.split("@")[0];
  const emailName = emailNameRaw.charAt(0).toUpperCase() + emailNameRaw.slice(1);

  // Convert to outbound domain for sending
  const outboundEmail = emailNameRaw + OUTBOUND_EMAIL_DOMAIN;

  return `${emailName} by Recoup <${outboundEmail}>`;
}
