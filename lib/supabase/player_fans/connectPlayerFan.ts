import { playerDatabase } from "../release_players/playerDatabase";
export async function connectPlayerFan(
  sessionId: string,
  revision: number,
  profile: { id: string; email?: string | null; display_name?: string | null },
  scopes: string[],
) {
  const { data, error } = await playerDatabase().rpc("connect_player_fan", {
    p_session: sessionId,
    p_revision: revision,
    p_spotify_id: profile.id,
    p_email: profile.email || null,
    p_display_name: profile.display_name || null,
    p_scopes: scopes,
  });
  if (error || typeof data !== "string") throw new Error("Could not save verified fan");
  return data;
}
