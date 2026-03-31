import { getAccountArtistIds } from "@/lib/supabase/account_artist_ids/getAccountArtistIds";

/**
 * Resolves an artist name to an artist_account_id by searching
 * the account's artist roster for the closest match.
 *
 * @param artistName - The artist name extracted from the prompt
 * @param accountId - The workspace account ID to search within
 * @returns The matching artist_id, or null if no match is found
 */
export async function resolveArtistFromName(
  artistName: string,
  accountId: string,
): Promise<string | null> {
  if (!artistName) return null;

  const artists = await getAccountArtistIds({ accountIds: [accountId] });
  if (!artists || artists.length === 0) return null;

  const query = artistName.toLowerCase();

  // Try exact match first (case-insensitive)
  const exactMatch = artists.find(
    a =>
      (a as unknown as { artist_info: { name: string } }).artist_info?.name?.toLowerCase() ===
      query,
  );
  if (exactMatch) return exactMatch.artist_id;

  // Try prefix/includes match
  const partialMatch = artists.find(a => {
    const name = (
      a as unknown as { artist_info: { name: string } }
    ).artist_info?.name?.toLowerCase();
    return name?.includes(query) || query.includes(name ?? "");
  });
  if (partialMatch) return partialMatch.artist_id;

  return null;
}
