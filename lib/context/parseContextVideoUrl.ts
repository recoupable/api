import { parseContextUrl } from "./parseContextUrl";

/** Parse one submitted YouTube video locator without routing it through Spotify track ingestion. */
export function parseContextVideoUrl(input: string) {
  const resource = parseContextUrl(input);
  if (resource.provider !== "youtube" || resource.kind !== "video")
    throw new Error("Use a single YouTube video URL; Spotify tracks use ingest");
  return { id: resource.id, url: resource.url };
}
