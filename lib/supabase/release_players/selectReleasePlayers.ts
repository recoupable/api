import { playerDatabase } from "./playerDatabase";
export async function selectReleasePlayers(owner: string) {
  const { data, error } = await playerDatabase()
    .from("release_players")
    .select("*")
    .eq("owner_id", owner)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error("Could not list players");
  return data || [];
}
