import { playerDatabase } from "../release_players/playerDatabase";
import type { ListeningEvent } from "@/lib/players/schema";
export async function insertPlayerListeningEvent(
  sessionId: string,
  revision: number,
  event: ListeningEvent,
) {
  const { data, error } = await playerDatabase().rpc("record_player_listening", {
    p_session: sessionId,
    p_revision: revision,
    p_provider: event.provider,
    p_id: event.id,
    p_event: event.event,
    p_track: event.trackId,
    p_position: event.positionMs,
    p_listened: event.listenedMs,
  });
  if (error) throw new Error("Could not save listening event");
  return data === true;
}
