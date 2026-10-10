import { playerDatabase } from "./playerDatabase";
export async function selectReleasePlayers(owner: string, offset = 0, limit = 50) {
  const { data, error } = await playerDatabase()
    .from("release_players")
    .select("*")
    .eq("owner_id", owner)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw new Error("Could not list players");
  return data || [];
}
