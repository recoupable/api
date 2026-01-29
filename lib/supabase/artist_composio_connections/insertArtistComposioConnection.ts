import supabase from "../serverClient";
import type { Tables, TablesInsert } from "@/types/database.types";

/**
 * Inserts or updates (upserts) an artist_composio_connection.
 * Uses the unique constraint on (artist_id, toolkit_slug) for conflict resolution.
 *
 * @param connection - The connection data to insert
 * @returns The upserted connection row
 */
export async function insertArtistComposioConnection(
  connection: TablesInsert<"artist_composio_connections">,
): Promise<{ data: Tables<"artist_composio_connections"> | null; error: unknown }> {
  const { data, error } = await supabase
    .from("artist_composio_connections")
    .upsert(connection, {
      onConflict: "artist_id,toolkit_slug",
    })
    .select()
    .single();

  if (error) {
    return { data: null, error };
  }

  return { data, error: null };
}
