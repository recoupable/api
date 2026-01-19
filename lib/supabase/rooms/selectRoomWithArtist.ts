import supabase from "../serverClient";

type RoomWithArtist = {
  id: string;
  artist_id: string | null;
  artist_name: string | null;
};

/**
 * Select a room with its associated artist name from accounts table.
 *
 * @param roomId - The room ID to query.
 * @returns The room data with artist name, or null if not found.
 */
export async function selectRoomWithArtist(roomId: string): Promise<RoomWithArtist | null> {
  const { data, error } = await supabase
    .from("rooms")
    .select("id, artist_id, accounts!rooms_artist_id_fkey(name)")
    .eq("id", roomId)
    .single();

  if (error || !data) return null;

  const account = Array.isArray(data.accounts) ? data.accounts[0] : data.accounts;

  return {
    id: data.id,
    artist_id: data.artist_id,
    artist_name: account?.name || null,
  };
}
