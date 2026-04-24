import { getEnterpriseAccountIds } from "@/lib/enterprise/getEnterpriseAccountIds";
import { getActiveSubscriptionAccountIds } from "@/lib/stripe/getActiveSubscriptionAccountIds";
import { selectAccountArtistIds } from "@/lib/supabase/account_artist_ids/selectAccountArtistIds";

/**
 * Deduped artist_ids owned by "pro" accounts — enterprise email domain OR
 * active Stripe subscription. Dedupes at both layers (account_id then
 * artist_id) so accounts present in both sources and artists shared across
 * accounts do not produce cartesian-product rows. Short-circuits before the
 * account_artist_ids query when no pro accounts are found.
 */
export async function getProArtists(): Promise<string[]> {
  const [enterpriseIds, subscriberIds] = await Promise.all([
    getEnterpriseAccountIds(),
    getActiveSubscriptionAccountIds(),
  ]);

  const accountIds = Array.from(new Set([...enterpriseIds, ...subscriberIds]));
  if (accountIds.length === 0) return [];

  const artistIdRows = await selectAccountArtistIds(accountIds);

  return Array.from(
    new Set(artistIdRows.map(row => row.artist_id).filter((id): id is string => Boolean(id))),
  );
}
