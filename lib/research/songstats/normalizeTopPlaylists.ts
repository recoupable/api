import { extractList } from "@/lib/research/songstats/extractList";
import { isRecord } from "@/lib/research/songstats/isRecord";

/**
 * Flattens SongStats `/artists/top_playlists` (and `/tracks/top_playlists`)
 * into a single placement list. The provider nests the rows one level deep:
 * `{ data: [{ source, scope, top_playlists: [...] }] }` — one entry per source.
 */
export function normalizeTopPlaylists(value: unknown): unknown[] {
  return extractList(value, ["data"]).flatMap(entry =>
    isRecord(entry) && Array.isArray(entry.top_playlists) ? entry.top_playlists : [],
  );
}
