import { parseContextUrl, type ContextResource } from "../parseContextUrl";
import { parseContextReleaseUrl } from "../parseContextReleaseUrl";

export type ContextUnsupportedInputReason =
  | "invalid_url"
  | "not_public_https"
  | "spotify_playlist"
  | "spotify_artist"
  | "youtube_playlist"
  | "youtube_channel"
  | "unrecognized";

export type ContextInputClassification =
  | {
      routing: "ingest";
      resource: ContextResource;
      /** Mirrors the current pilot gate: `ingest` rejects non-Spotify resources. */
      pilot: "enabled" | "not_enabled";
    }
  | {
      routing: "ingest_release";
      resource: { provider: "spotify"; kind: "album"; id: string; url: string };
    }
  | { routing: "unsupported"; reason: ContextUnsupportedInputReason; message: string };

const YOUTUBE_HOSTS = ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"];

/**
 * Classify a submitted URL into the existing Context action that owns it, or an
 * explicit unsupported reason, without any provider call.
 *
 * Routing is a decision, not a dispatch: this function does not call `ingest` or
 * `ingest_release`. Spotify tracks and single YouTube videos belong to `ingest`;
 * Spotify albums (including a single's album page) belong to `ingest_release`;
 * playlists, artist pages, channels and unknown hosts are rejected with a reason
 * so a caller can explain unsupported input before spending anything.
 *
 * @param input - The raw URL string a customer submitted.
 * @returns The routing decision with a normalized resource or an unsupported reason.
 */
export function classifyContextInputUrl(input: string): ContextInputClassification {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return unsupported("invalid_url", "Submit a complete URL, for example a Spotify track link");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port)
    return unsupported(
      "not_public_https",
      "Use a public HTTPS URL without embedded credentials or a custom port",
    );
  try {
    const resource = parseContextUrl(input);
    return {
      routing: "ingest",
      resource,
      pilot: resource.provider === "spotify" ? "enabled" : "not_enabled",
    };
  } catch {
    // Not a single track or video; keep classifying.
  }
  try {
    const release = parseContextReleaseUrl(input);
    return {
      routing: "ingest_release",
      resource: { provider: "spotify", kind: "album", id: release.id, url: release.url },
    };
  } catch {
    // Not an album; keep classifying.
  }
  const path = url.pathname.replace(/^\/intl-[a-z]{2}(?=\/)/, "");
  if (url.hostname === "open.spotify.com") {
    if (/^\/playlist\//.test(path))
      return unsupported(
        "spotify_playlist",
        "Spotify playlists are not supported; submit one track or one album URL",
      );
    if (/^\/artist\//.test(path))
      return unsupported(
        "spotify_artist",
        "Spotify artist pages are not supported; submit one track or one album URL",
      );
  }
  if (YOUTUBE_HOSTS.includes(url.hostname)) {
    if (path === "/playlist" || (path === "/watch" && !url.searchParams.has("v")))
      return unsupported(
        "youtube_playlist",
        "YouTube playlists are not supported; submit one video URL",
      );
    if (/^\/(?:channel\/|c\/|user\/|@)/.test(path))
      return unsupported(
        "youtube_channel",
        "YouTube channels are not supported; submit one video URL",
      );
  }
  return unsupported(
    "unrecognized",
    "Use a Spotify track, Spotify album or single YouTube video URL",
  );
}

/**
 * Build an unsupported classification with a customer-facing explanation.
 *
 * @param reason - Stable machine-readable reason.
 * @param message - Explanation safe to show the submitter.
 * @returns The unsupported classification.
 */
function unsupported(
  reason: ContextUnsupportedInputReason,
  message: string,
): ContextInputClassification {
  return { routing: "unsupported", reason, message };
}
