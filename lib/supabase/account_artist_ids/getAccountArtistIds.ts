import supabase from "../serverClient";
import type { ArtistQueryRow } from "@/lib/artists/getFormattedArtist";

// Raw row type returned by this query
export type AccountArtistRow = ArtistQueryRow & { artist_id: string; pinned: boolean };

/**
 * Get all artists for an array of artist IDs or account IDs, with full info.
 * Returns raw data - formatting should be done by caller.
 *
 * @param params Object with artistIds or accountIds array
 * @returns Array of raw artist rows from database
 */
export async function getAccountArtistIds(params: {
  artistIds?: string[];
  accountIds?: string[];
}): Promise<AccountArtistRow[]> {
  const { artistIds, accountIds } = params;
  if (!artistIds && !accountIds) {
    throw new Error("Must provide either artistIds or accountIds");
  }

  let query = supabase.from("account_artist_ids").select(`*,
    artist_info:accounts!account_artist_ids_artist_id_fkey (
      *,
      account_socials (
        *,
        social:socials (*)
      ),
      account_info (*)
    )
  `);

  if (artistIds) {
    query = query.in("artist_id", artistIds);
  } else if (accountIds) {
    query = query.in("account_id", accountIds);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error getting account-artist IDs:", error);
    return [];
  }

  return (data || []) as unknown as AccountArtistRow[];
}

