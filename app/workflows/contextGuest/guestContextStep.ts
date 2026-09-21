import { runGuestContext } from "@/lib/context/guest/runGuestContext";
import { callContextRpc } from "@/lib/supabase/context_requests/callContextRpc";
import { authorizeContextOwner } from "@/lib/context/authorizeContextOwner";
import { fetchSpotifyContext } from "@/lib/context/fetchSpotifyContext";
import generateAccessToken from "@/lib/spotify/generateAccessToken";
export async function guestContextStep(id: string) {
  "use step";
  return runGuestContext(id, {
    rpc: callContextRpc,
    authorize: (actor, owner) => authorizeContextOwner(actor, owner === actor ? undefined : owner),
    extract: async track => {
      const token = await generateAccessToken();
      if (!token.access_token) throw new Error("Spotify authentication unavailable");
      return fetchSpotifyContext(track, token.access_token);
    },
  });
}
