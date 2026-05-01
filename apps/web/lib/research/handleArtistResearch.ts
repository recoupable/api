import { resolveArtist } from "@/lib/research/resolveArtist";
import { fetchChartmetric } from "@/lib/chartmetric/fetchChartmetric";
import { deductCredits } from "@/lib/credits/deductCredits";

export type HandleArtistResearchParams = {
  artist: string;
  accountId: string;
  path: (cmId: number) => string;
  query?: Record<string, string>;
  /** Credits to charge on success. Defaults to 5. */
  credits?: number;
};

export type HandleArtistResearchResult = { data: unknown } | { error: string; status: number };

/**
 * Resolves an artist to a Chartmetric ID, proxies to the built upstream path,
 * and deducts credits on success. Credit deduction errors are non-fatal —
 * the fetched data is still returned so transient billing failures don't
 * block read endpoints.
 *
 * @returns `{ data }` on success, `{ error, status }` on failure.
 */
export async function handleArtistResearch(
  params: HandleArtistResearchParams,
): Promise<HandleArtistResearchResult> {
  const { artist, accountId, path, query, credits = 5 } = params;

  const resolved = await resolveArtist(artist);
  if (resolved.error) return { error: resolved.error, status: 404 };

  const result = await fetchChartmetric(path(resolved.id), query);
  if (result.status !== 200) {
    return { error: `Request failed with status ${result.status}`, status: result.status };
  }

  try {
    await deductCredits({ accountId, creditsToDeduct: credits });
  } catch (error) {
    console.error("[research] credit deduction failed:", error);
  }

  return { data: result.data };
}
