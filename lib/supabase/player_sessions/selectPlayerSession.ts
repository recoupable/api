import { playerDatabase } from "../release_players/playerDatabase";
export async function selectPlayerSession(id: string) {
  const { data, error } = await playerDatabase()
    .from("player_sessions")
    .select("id,player_id,revision,provider,fan_id,created_at,expires_at,connected_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Could not read listening session");
  return data;
}
