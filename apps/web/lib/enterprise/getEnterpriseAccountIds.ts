import { ENTERPRISE_DOMAINS } from "@/lib/enterprise/consts";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";

/**
 * Resolve account_ids whose email belongs to an enterprise domain. Fans out
 * one ilike query per domain in parallel and projects down to account_ids —
 * the email rows themselves aren't consumed downstream.
 */
export async function getEnterpriseAccountIds(): Promise<string[]> {
  const rowsPerDomain = await Promise.all(
    Array.from(ENTERPRISE_DOMAINS).map(domain => selectAccountEmails({ domain })),
  );

  return rowsPerDomain
    .flat()
    .map(row => row.account_id)
    .filter((id): id is string => Boolean(id));
}
