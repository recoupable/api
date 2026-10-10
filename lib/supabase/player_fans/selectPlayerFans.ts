import { playerDatabase } from "../release_players/playerDatabase";
export async function selectPlayerFans(
  owner: string,
  artist: string,
  offset: number,
  limit: number,
) {
  const { data, error } = await playerDatabase()
    .from("player_fans")
    .select("id,provider,email,display_name,first_connected_at,last_connected_at")
    .eq("owner_id", owner)
    .eq("artist_id", artist)
    .order("last_connected_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw new Error("Could not read fans");
  return data || [];
}
