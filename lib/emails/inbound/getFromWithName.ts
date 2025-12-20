/**
 * Gets a formatted "from" email address with a human-readable name.
 *
 * @param toEmails - Array of email addresses from the 'to' field
 * @returns Formatted email address with display name (e.g., "Support <support@mail.recoupable.com>")
 * @throws Error if no email ending with "@mail.recoupable.com" is found
 */
export function getFromWithName(toEmails: string[]): string {
  // Find the first email in the 'to' array that ends with "@mail.recoupable.com"
  const customFromEmail = toEmails.find(email =>
    email.toLowerCase().endsWith("@mail.recoupable.com"),
  );

  if (!customFromEmail) {
    throw new Error("No email found ending with @mail.recoupable.com in the 'to' array");
  }

  // Extract the name part (everything before the @ sign) for a human-readable from name
  const emailNameRaw = customFromEmail.split("@")[0];
  const emailName = emailNameRaw.charAt(0).toUpperCase() + emailNameRaw.slice(1);
  return `${emailName} <${customFromEmail}>`;
}
