import { SiteError } from "@/lib/sites/SiteError";
export function getPlayerOAuthConfig() {
  const origin = process.env.PLAYER_APP_ORIGIN || "https://app.recoupable.dev";
  const url = new URL(origin);
  if (
    url.origin !== origin ||
    (url.protocol !== "https:" &&
      !(process.env.NODE_ENV !== "production" && url.hostname === "localhost"))
  )
    throw new SiteError(503, "Invalid trusted player origin");
  return {
    origin,
    clientId: process.env.SITES_SPOTIFY_CLIENT_ID || null,
    redirectUri: `${origin}/s/spotify/callback`,
    scopes: [
      "streaming",
      "user-read-email",
      "user-read-private",
      "user-modify-playback-state",
      "user-read-playback-state",
    ],
  };
}
