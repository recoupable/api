import { fetchSongstatsResearch } from "@/lib/research/songstats/fetchSongstatsResearch";
import type { ProxyResult } from "@/lib/research/providers/ProxyResult";

/** Fetches research data from SongStats (sole provider). */
export async function fetchResearchProvider(
  path: string,
  queryParams?: Record<string, string>,
): Promise<ProxyResult> {
  return fetchSongstatsResearch(path, queryParams);
}
