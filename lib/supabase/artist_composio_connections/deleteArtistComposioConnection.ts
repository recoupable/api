import supabase from "../serverClient";

/**
 * Deletes an artist_composio_connection by its ID.
 *
 * @param connectionId - The connection's unique ID
 * @returns Object with error property (null if successful)
 */
export async function deleteArtistComposioConnection(connectionId: string) {
  const { error } = await supabase
    .from("artist_composio_connections")
    .delete()
    .eq("id", connectionId);

  if (error) {
    return { error };
  }

  return { error: null };
}
