import type { ProxyResult } from "@/lib/research/ProxyResult";
import { fetchSongstats } from "@/lib/songstats/fetchSongstats";

/**
 * Fetches a SongStats endpoint and optionally normalizes a successful payload.
 */
export async function mapSongstatsResult(
  endpoint: string,
  query?: Record<string, string>,
  normalize?: (value: unknown) => unknown,
): Promise<ProxyResult> {
  const result = await fetchSongstats(endpoint, query);
  if (result.status !== 200 || !normalize) return result;
  return { status: result.status, data: normalize(result.data) };
}
