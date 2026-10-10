import { playerDatabase } from "../release_players/playerDatabase";
export async function getPlayerReport(owner: string, player: string, offset: number) {
  const { data, error } = await playerDatabase().rpc("read_player_report", {
    p_owner: owner,
    p_player: player,
    p_offset: offset,
  });
  if (error) throw new Error("Could not read listening report");
  return data;
}
