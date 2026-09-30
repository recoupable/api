import { fanConnectionDatabase } from "./fanConnectionDatabase";
export async function completeFanConnection(input: {
  stateHash: string;
  spotifyId: string;
  displayName: string | null;
  email: string | null;
  scopes: string[];
}) {
  const { data, error } = await fanConnectionDatabase().rpc("complete_site_fan_connection", {
    p_state_hash: input.stateHash,
    p_spotify_id: input.spotifyId,
    p_display_name: input.displayName,
    p_email: input.email,
    p_scopes: input.scopes,
  });
  if (error || typeof data !== "string") throw new Error("Could not save fan connection");
  return data;
}
