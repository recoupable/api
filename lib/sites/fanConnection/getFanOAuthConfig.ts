import { SiteError } from "../SiteError";
/** Dedicated callback configuration: never reuse the playback browser callback. */
export function getFanOAuthConfig() {
  const clientId = process.env.SITES_SPOTIFY_CLIENT_ID;
  const callback = process.env.SITES_FAN_SPOTIFY_REDIRECT_URI;
  if (!clientId || !callback) throw new SiteError(503, "Fan connection is not configured");
  const url = new URL(callback);
  if (
    url.protocol !== "https:" ||
    url.pathname !== "/api/sites/spotify/callback" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  )
    throw new SiteError(503, "Fan callback configuration is invalid");
  return {
    clientId,
    callback,
    origin: url.origin,
    scopes: ["user-read-email", "user-read-private"],
  };
}
