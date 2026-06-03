import type { ProxyResult } from "@/lib/research/providers/ProxyResult";
import { mapSongstatsArtistPath } from "@/lib/research/songstats/mapSongstatsArtistPath";
import { mapSongstatsTrackPath } from "@/lib/research/songstats/mapSongstatsTrackPath";
import {
  extractList,
  mapSongstatsResult,
  normalizeArtistRecord,
  normalizeTrackRecord,
  UNSUPPORTED_RESULT,
  withoutLegacySearchParams,
} from "@/lib/research/songstats/songstatsResearchMapping";

function mapEntitySearch(
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

export async function fetchSongstatsResearch(
  path: string,
  query?: Record<string, string>,
): Promise<ProxyResult> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return (
    (await mapEntitySearch(normalizedPath, query)) ||
    (await mapSongstatsArtistPath(normalizedPath, query)) ||
    (await mapSongstatsTrackPath(normalizedPath, query)) ||
    UNSUPPORTED_RESULT
  );
}
