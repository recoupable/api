import { getAllEnterpriseAccounts } from "@/lib/enterprise/getAllEnterpriseAccounts";
import { getSubscriberAccountEmails } from "@/lib/enterprise/getSubscriberAccountEmails";
import { selectAccountArtistIds } from "@/lib/supabase/account_artist_ids/selectAccountArtistIds";

/**
 * Resolve the deduped list of artist_ids owned by "pro" accounts — enterprise
 * email domain or active Stripe subscription. Dedupes at both layers
 * (account_id then artist_id) so accounts present in both sources and artists
 * shared across accounts do not produce cartesian-product rows. Short-circuits
 * when no pro accounts are found before hitting `account_artist_ids`.
 */
export async function getEnterpriseArtists(): Promise<string[]> {
  const [enterpriseEmails, subscriberEmails] = await Promise.all([
    getAllEnterpriseAccounts(),
    getSubscriberAccountEmails(),
  ]);

  const accountIds = new Set(
    [...enterpriseEmails, ...subscriberEmails]
      .map(row => row.account_id)
      .filter((id): id is string => Boolean(id)),
  );

  if (accountIds.size === 0) return [];

  const artistIdRows = await selectAccountArtistIds(Array.from(accountIds));

  return Array.from(
    new Set(artistIdRows.map(row => row.artist_id).filter((id): id is string => Boolean(id))),
  );
}
