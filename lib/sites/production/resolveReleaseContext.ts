import type { Site } from "../schema";
import { resolveSpotifyRelease } from "../resolveSpotifyRelease";
import type { ReleaseContext } from "./schema";
/** Never guesses an artist from a title. Spotify metadata and its preview are optional enrichment. */
export async function resolveReleaseContext(site: Site): Promise<ReleaseContext["release"]> {
  const base = site.release_url
    ? await resolveSpotifyRelease(site.release_url)
    : { url: "", title: site.name, artwork: null };
  const release: ReleaseContext["release"] = {
    ...base,
    artists: [],
    date: null,
    isrc: null,
    previewUrl: null,
  };
  const match = /^https:\/\/open\.spotify\.com\/track\/([a-zA-Z0-9]+)$/.exec(base.url);
  if (!match || !process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET)
    return release;
  try {
    const { default: token } = await import("@/lib/spotify/generateAccessToken");
    const auth = await token();
    if (!auth.access_token) return release;
    const response = await fetch(`https://api.spotify.com/v1/tracks/${match[1]}`, {
      headers: { Authorization: `Bearer ${auth.access_token}` },
      signal: AbortSignal.timeout(12000),
      redirect: "error",
    });
    if (!response.ok) return release;
    const track = await response.json();
    release.title = typeof track.name === "string" ? track.name : base.title;
    release.artists = (track.artists ?? [])
      .map((a: { name: string }) => a.name)
      .filter((name: unknown) => typeof name === "string");
    release.date = track.album?.release_date ?? null;
    release.isrc = track.external_ids?.isrc ?? null;
    if (typeof track.preview_url === "string") {
      const preview = new URL(track.preview_url);
      if (
        preview.protocol === "https:" &&
        (preview.hostname.endsWith(".scdn.co") || preview.hostname.endsWith(".spotifycdn.com"))
      )
        release.previewUrl = preview.href;
    }
  } catch {
    /* Metadata enrichment failure must not invent music evidence. */
  }
  return release;
}
