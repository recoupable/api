import { ENTERPRISE_DOMAINS } from "@/lib/enterprise/consts";
import { selectAccountEmailsByDomain } from "@/lib/supabase/account_emails/selectAccountEmailsByDomain";

/**
 * Fan-out an ilike query per enterprise domain in parallel and flatten the
 * results. Not deduped here — downstream `getEnterpriseArtists` merges with
 * the subscriber set and dedupes on `account_id`.
 */
export async function getAllEnterpriseAccounts() {
  const emailArrays = await Promise.all(
    Array.from(ENTERPRISE_DOMAINS).map(domain => selectAccountEmailsByDomain(domain)),
  );
  return emailArrays.flat();
}
