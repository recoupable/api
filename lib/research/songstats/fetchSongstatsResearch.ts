import type { ProxyResult } from "@/lib/research/ProxyResult";
import { mapEntitySearch } from "@/lib/research/songstats/mapEntitySearch";
import { mapSongstatsArtistPath } from "@/lib/research/songstats/mapSongstatsArtistPath";
import { mapSongstatsTrackPath } from "@/lib/research/songstats/mapSongstatsTrackPath";
import { UNSUPPORTED_RESULT } from "@/lib/research/songstats/songstatsResearchMapping";

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
