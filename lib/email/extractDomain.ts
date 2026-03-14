/**
 * Extracts the domain from an email address.
 *
 * @param email - The email address to extract domain from
 * @returns The domain portion of the email, or null if invalid
 */
export function extractDomain(email: string): string | null {
  if (!email || typeof email !== "string") {
    return null;
  }

  const parts = email.split("@");
  if (parts.length !== 2 || !parts[1]) {
    return null;
  }

  return parts[1].toLowerCase();
}
