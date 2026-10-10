import { z } from "zod";
import { requirePlayerSession } from "./requirePlayerSession";
import { getPlayerOAuthConfig } from "./getPlayerOAuthConfig";
import { connectPlayerFan } from "@/lib/supabase/player_fans/connectPlayerFan";
import { limitSiteRequest } from "@/lib/sites/activity/limitSiteRequest";
import { SiteError } from "@/lib/sites/SiteError";
/** Credentials are returned only to the trusted Recoup player, never the embedding site. */
export async function exchangePlayerSpotify(input: unknown) {
  const value = z
    .object({
      code: z.string().min(1).max(2048),
      verifier: z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/),
      flow: z.string().min(1).max(2048),
    })
    .strict()
    .parse(input);
  const { context, session } = await requirePlayerSession(value.flow),
    oauth = getPlayerOAuthConfig();
  if (
    session.provider !== "spotify" ||
    session.connected_at ||
    Date.now() - new Date(session.created_at).getTime() > 600000
  )
    throw new SiteError(403, "Reconnect from a fresh player session");
  if (!oauth.clientId) throw new SiteError(503, "Spotify sign-in is not configured");
  await limitSiteRequest(context.playerId, "player-oauth", 60);
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: oauth.clientId,
      redirect_uri: oauth.redirectUri,
      code: value.code,
      code_verifier: value.verifier,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new SiteError(401, "Spotify authorization failed");
  const token = z
    .object({
      access_token: z.string().min(1),
      refresh_token: z.string().optional(),
      expires_in: z.number().positive(),
      scope: z.string(),
      token_type: z.string().optional(),
    })
    .parse(await response.json());
  const scopes = [...new Set(token.scope.split(/\s+/).filter(Boolean))];
  if (!oauth.scopes.every(scope => scopes.includes(scope)))
    throw new SiteError(403, "Required Spotify permissions were not granted");
  let saved = false;
  try {
    const profileResponse = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${token.access_token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!profileResponse.ok) throw new Error("Profile unavailable");
    const profile = z
      .object({
        id: z.string().min(1).max(255),
        email: z.string().email().max(254).nullish(),
        display_name: z.string().max(255).nullish(),
      })
      .parse(await profileResponse.json());
    await connectPlayerFan(context.sessionId, context.revision, profile, scopes);
    saved = true;
  } catch {
    console.error("[players] Verified fan capture unavailable");
  }
  return { ...token, player_session_id: context.sessionId, fanCapture: saved };
}
