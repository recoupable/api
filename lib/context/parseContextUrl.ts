import { ContextIngestFailure } from "./ContextIngestFailure";

export interface ContextResource {
  provider: "spotify" | "youtube";
  kind: "track" | "video";
  id: string;
  url: string;
}

/** Parse supported public resource identity without fetching arbitrary URLs. */
export function parseContextUrl(input: string): ContextResource {
  const url = new URL(input);
  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    throw new Error("Use a public HTTPS Spotify track or YouTube video URL");
  }
  if (url.hostname === "open.spotify.com") {
    const path = url.pathname.replace(/^\/intl-[a-z]{2}\//, "/");
    const match = path.match(/^\/track\/([A-Za-z0-9]{22})\/?$/);
    if (match)
      return {
        provider: "spotify",
        kind: "track",
        id: match[1],
        url: `https://open.spotify.com/track/${match[1]}`,
      };
    // Explicit routing for other Spotify entities; none of them is a track input.
    const kind = path.match(/^\/(album|playlist|artist)\/[A-Za-z0-9]+\/?$/)?.[1];
    throw new ContextIngestFailure(
      "unsupported_input",
      kind === "album"
        ? "Spotify album URLs are saved with the ingest_release action; track ingestion needs a single track URL"
        : kind === "playlist"
          ? "Spotify playlists are not supported; collection semantics are not built yet"
          : kind === "artist"
            ? "Spotify artist pages are not track inputs; submit one of the artist's track URLs"
            : "Context ingestion currently supports individual Spotify tracks",
    );
  }
  let id: string | undefined;
  if (url.hostname === "youtu.be") id = url.pathname.match(/^\/([A-Za-z0-9_-]{11})\/?$/)?.[1];
  if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname)) {
    if (url.pathname === "/watch" && url.searchParams.getAll("v").length === 1)
      id = url.searchParams.get("v") ?? undefined;
    else id = url.pathname.match(/^\/(?:shorts|embed)\/([A-Za-z0-9_-]{11})\/?$/)?.[1];
  }
  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id))
    throw new Error("Use a Spotify track or a single YouTube video URL");
  return { provider: "youtube", kind: "video", id, url: `https://www.youtube.com/watch?v=${id}` };
}
