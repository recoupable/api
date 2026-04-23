import { ENTERPRISE_DOMAINS } from "@/lib/enterprise/consts";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";

/**
 * Fan-out an ilike query per enterprise domain in parallel and flatten the
 * results. Not deduped here — downstream `getEnterpriseArtists` merges with
 * the subscriber set and dedupes on `account_id`.
 */
export async function getAllEnterpriseAccounts() {
  const emailArrays = await Promise.all(
    Array.from(ENTERPRISE_DOMAINS).map(domain => selectAccountEmails({ domain })),
  );
  return emailArrays.flat();
}
