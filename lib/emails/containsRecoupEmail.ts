import { RECOUP_EMAIL_DOMAIN } from "@/lib/const";

/**
 * Checks if any email address in the array is a recoup email address.
 *
 * @param addresses - The array of email addresses to check
 * @returns True if any address is a recoup email, false otherwise
 */
export function containsRecoupEmail(addresses: string[]): boolean {
  return addresses.some(addr => addr.toLowerCase().includes(RECOUP_EMAIL_DOMAIN));
}
