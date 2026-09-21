import { authorizeContextOwner } from "./authorizeContextOwner";
import { fetchSpotifyContext } from "./fetchSpotifyContext";
import { runContextRequest } from "./runContextRequest";
import { callContextRpc } from "@/lib/supabase/context_requests/callContextRpc";
/** Workflow execution adapter. No alternate auth, database or provider path. */
export async function runStoredContextRequest(actor: string, owner: string, requestId: string) {
  return runContextRequest(actor, owner, requestId, {
    rpc: callContextRpc,
    authorize: (account, scope) =>
      authorizeContextOwner(account, scope === account ? undefined : scope),
    extract: async id => {
      const { default: generateAccessToken } = await import("@/lib/spotify/generateAccessToken");
      const token = await generateAccessToken();
      if (!token.access_token) throw new Error("Spotify authentication unavailable");
      return fetchSpotifyContext(id, token.access_token);
    },
  });
}
