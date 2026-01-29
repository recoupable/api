import supabase from "../serverClient";
import type { Tables } from "@/types/database.types";

/**
 * Selects all artist_composio_connections for a given artist.
 *
 * @param artistId - The artist's ID (from account_info)
 * @returns Array of connection rows, or empty array if none found
 */
export async function selectArtistComposioConnections(
  artistId: string,
): Promise<Tables<"artist_composio_connections">[]> {
  const { data, error } = await supabase
    .from("artist_composio_connections")
    .select("*")
    .eq("artist_id", artistId);

  if (error || !data) {
    return [];
  }

  return data;
}
