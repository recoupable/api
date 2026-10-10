import { playerDatabase } from "../release_players/playerDatabase";
export async function insertPlayerSession(input: {
  id: string;
  player_id: string;
  revision: number;
  provider: string;
  acquisition: unknown;
  expires_at: string;
}) {
  const { error } = await playerDatabase().from("player_sessions").insert(input);
  if (error) throw new Error("Could not start listening session");
}
