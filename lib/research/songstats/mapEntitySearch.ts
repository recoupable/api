import type { ProxyResult } from "@/lib/research/ProxyResult";
import { extractList } from "@/lib/research/songstats/extractList";
import { mapSongstatsResult } from "@/lib/research/songstats/mapSongstatsResult";
import { normalizeArtistRecord } from "@/lib/research/songstats/normalizeArtistRecord";
import { normalizeTrackRecord } from "@/lib/research/songstats/normalizeTrackRecord";
import { UNSUPPORTED_RESULT } from "@/lib/research/songstats/unsupportedResult";
import { withoutLegacySearchParams } from "@/lib/research/songstats/withoutLegacySearchParams";

/**
 * Maps `/search` to the matching SongStats search endpoint by `type`
 * (artists | tracks | labels). Returns an explicit unsupported result for any
 * other type, and `null` for non-search paths so callers can try other mappers.
 */
export function mapEntitySearch(
  path: string,
  query?: Record<string, string>,
): Promise<ProxyResult> | null {
  if (path !== "/search") return null;

  const type = (query?.type || "artists").toLowerCase();
  if (type === "artists" || type === "artist") {
    return mapSongstatsResult("/artists/search", withoutLegacySearchParams(query), data => ({
      artists: extractList(data, ["artists", "results", "data", "items"]).map(
        normalizeArtistRecord,
      ),
    }));
  }

  if (type === "tracks" || type === "track") {
    return mapSongstatsResult("/tracks/search", withoutLegacySearchParams(query), data => ({
      tracks: extractList(data, ["tracks", "results", "data", "items"]).map(normalizeTrackRecord),
    }));
  }

  if (type === "labels" || type === "label") {
    return mapSongstatsResult("/labels/search", withoutLegacySearchParams(query), data => ({
      labels: extractList(data, ["labels", "results", "data", "items"]),
    }));
  }

  return Promise.resolve(UNSUPPORTED_RESULT);
}
