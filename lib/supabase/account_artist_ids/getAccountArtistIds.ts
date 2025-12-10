import supabase from "../serverClient";
import { getFormattedArtist, FormattedArtist } from "@/lib/artists/getFormattedArtist";

/**
 * Get all artists for an array of artist IDs or account IDs, with full info.
 *
 * @param params Object with artistIds or accountIds array
 * @returns Array of formatted artist objects
 */
export async function getAccountArtistIds(params: {
  artistIds?: string[];
  accountIds?: string[];
}): Promise<FormattedArtist[]> {
  const { artistIds, accountIds } = params;
  if (!artistIds && !accountIds) {
    throw new Error("Must provide either artistIds or accountIds");
  }

  try {
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

    // Format each artist_info using getFormattedArtist
    return (data || []).map(row => getFormattedArtist(row));
  } catch (error) {
    console.error("Unexpected error in getAccountArtistIds:", error);
    return [];
  }
}

