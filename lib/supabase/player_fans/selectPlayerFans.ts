import { z } from "zod";
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
    .order("id", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) {
    console.error("Player fan lookup failed", { code: error.code });
    throw new Error("Could not read fans");
  }
  return z
    .array(
      z.object({
        id: z.string().uuid(),
        provider: z.literal("spotify"),
        email: z.string().nullable(),
        display_name: z.string().nullable(),
        first_connected_at: z.string(),
        last_connected_at: z.string(),
      }),
    )
    .parse(data || []);
}
