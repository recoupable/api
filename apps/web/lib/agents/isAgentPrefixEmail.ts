/**
 * Checks if an email address uses the agent+ prefix.
 *
 * @param email - The email address to check
 * @returns True if the email starts with "agent+"
 */
export function isAgentPrefixEmail(email: string): boolean {
  return email.toLowerCase().startsWith("agent+");
}
