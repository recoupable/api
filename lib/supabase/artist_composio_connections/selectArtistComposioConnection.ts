import supabase from "../serverClient";
import type { Tables } from "@/types/database.types";

/**
 * Selects a single artist_composio_connection by artist_id and toolkit_slug.
 *
 * @param artistId - The artist's ID (from account_info)
 * @param toolkitSlug - The toolkit identifier (e.g., 'tiktok')
 * @returns The connection row or null if not found
 */
export async function selectArtistComposioConnection(
  artistId: string,
  toolkitSlug: string,
): Promise<Tables<"artist_composio_connections"> | null> {
  const { data, error } = await supabase
    .from("artist_composio_connections")
    .select("*")
    .eq("artist_id", artistId)
    .eq("toolkit_slug", toolkitSlug)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}
