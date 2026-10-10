import { z } from "zod";
import { playerDatabase } from "../release_players/playerDatabase";
export async function selectWorkspacePlayerFans(owner: string, offset: number, limit: number) {
  const { data, error } = await playerDatabase()
    .from("player_fan_contacts")
    .select(
      "id,provider,email,display_name,first_connected_at,last_connected_at,artists:player_fans!player_fans_contact_identity_fkey(artist_id,first_connected_at,last_connected_at)",
    )
    .eq("owner_id", owner)
    .order("last_connected_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw new Error("Could not read workspace fans");
  return z
    .array(
      z.object({
        id: z.string().uuid(),
        provider: z.literal("spotify"),
        email: z.string().nullable(),
        display_name: z.string().nullable(),
        first_connected_at: z.string(),
        last_connected_at: z.string(),
        artists: z.array(
          z.object({
            artist_id: z.string().uuid(),
            first_connected_at: z.string(),
            last_connected_at: z.string(),
          }),
        ),
      }),
    )
    .parse(data || []);
}
