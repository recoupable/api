import { z } from "zod";
import { playerDatabase } from "../release_players/playerDatabase";
export async function getPlayerReport(owner: string, player: string, offset: number) {
  const { data, error } = await playerDatabase().rpc("read_player_report", {
    p_owner: owner,
    p_player: player,
    p_offset: offset,
  });
  if (error) throw new Error("Could not read listening report");
  return z
    .object({
      sessions: z.number().int().nonnegative(),
      connectedFans: z.number().int().nonnegative(),
      reportedListeningMs: z.number().nonnegative(),
      playEvents: z.number().int().nonnegative(),
      campaigns: z.array(z.record(z.string(), z.unknown())),
      activity: z.array(z.record(z.string(), z.unknown())),
    })
    .parse(data);
}
