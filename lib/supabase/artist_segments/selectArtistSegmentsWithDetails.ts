import supabase from "../serverClient";
import type { Tables } from "@/types/database.types";

/**
 * Type for the Supabase query result with joined segments and accounts
 */
export type SegmentQueryResult = Tables<"artist_segments"> & {
  segments: Tables<"segments"> | null;
  accounts: Tables<"accounts"> | null;
};

/**
 * Selects artist segments with joined segment and account data, filtered by artist account ID.
 *
 * @param artist_account_id - The unique identifier of the artist account
 * @param offset - The number of records to skip
 * @param limit - The maximum number of records to return
 * @returns The query results with joined segment and account data
 * @throws Error if the query fails
 */
export async function selectArtistSegmentsWithDetails(
  artist_account_id: string,
  offset: number,
  limit: number,
): Promise<SegmentQueryResult[] | null> {
  const queryText = `
      *,
      segments(*),
      accounts:artist_account_id(*)
    `;

  const { data, error } = await supabase
    .from("artist_segments")
    .select(queryText)
    .eq("artist_account_id", artist_account_id)
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to fetch artist segments: ${error.message}`);
  }

  return data as unknown as SegmentQueryResult[] | null;
}
