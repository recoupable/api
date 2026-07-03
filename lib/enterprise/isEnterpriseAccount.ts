import { ENTERPRISE_DOMAINS } from "@/lib/enterprise/consts";
import { extractDomain } from "@/lib/email/extractDomain";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";

/**
 * Resolves whether an account belongs to an enterprise customer: true when any
 * of the account's emails has a domain in ENTERPRISE_DOMAINS. Used by the
 * credits system to grant pro status without a Stripe subscription.
 */
export async function isEnterpriseAccount(accountId: string): Promise<boolean> {
  const rows = await selectAccountEmails({ accountIds: accountId });
  return rows.some(row => {
    const domain = row.email ? extractDomain(row.email) : null;
    return domain !== null && ENTERPRISE_DOMAINS.has(domain);
  });
}
