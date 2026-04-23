import { ENTERPRISE_DOMAINS } from "@/lib/consts";
import { extractDomain } from "@/lib/email/extractDomain";

/**
 * Returns true when the email's domain is on the enterprise allow-list.
 *
 * Enterprise-tagged accounts bypass the Stripe active-subscription check
 * in `GET /api/accounts/{id}/subscription`.
 */
export function isEnterprise(email: string): boolean {
  if (!email) return false;
  const domain = extractDomain(email);
  if (!domain) return false;
  return ENTERPRISE_DOMAINS.has(domain);
}
