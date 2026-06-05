import { extractList } from "@/lib/research/songstats/extractList";
import { filterCatalogItems } from "@/lib/research/songstats/filterCatalogItems";
import { isRecord } from "@/lib/research/songstats/isRecord";
import { normalizeTrackRecord } from "@/lib/research/songstats/normalizeTrackRecord";
import { parsePositiveLimit } from "@/lib/research/songstats/parsePositiveLimit";

function tracksFromSourceEntry(entry: unknown): unknown[] {
  if (!isRecord(entry)) return [];
  if (Array.isArray(entry.top_tracks) && entry.top_tracks.length) return entry.top_tracks;
  if (Array.isArray(entry.tracks) && entry.tracks.length) return entry.tracks;
  return [];
}

function flattenTopTracks(value: unknown): unknown[] {
  const fromData = extractList(value, ["data"]).flatMap(tracksFromSourceEntry);
  if (fromData.length) return fromData;

  return extractList(value, ["top_tracks", "tracks", "results", "items"]);
}

/**
 * Maps SongStats `/artists/top_tracks` to a curated track list (not full catalog).
 */
export function normalizeArtistTopTracks(data: unknown, query?: Record<string, string>): unknown[] {
  const items = flattenTopTracks(data);
  const filtered = filterCatalogItems(items, false).map(normalizeTrackRecord);

  const limit = parsePositiveLimit(query?.limit);
  return limit ? filtered.slice(0, limit) : filtered;
}
