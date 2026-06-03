import { resolveArtist } from "@/lib/research/resolveArtist";
import { fetchResearchProvider } from "@/lib/research/providers/fetchResearchProvider";
import { recordCreditDeduction } from "@/lib/credits/recordCreditDeduction";

export type HandleArtistResearchParams = {
  artist: string;
  artistId?: string;
  accountId: string;
  path: (providerArtistId: string) => string;
  query?: Record<string, string>;
  /** Credits to charge on success. Defaults to 5. */
  credits?: number;
};

export type HandleArtistResearchResult = { data: unknown } | { error: string; status: number };

/**
 * Resolves an artist to a provider artist ID, proxies to the built upstream
 * path, and deducts credits on success. Credit-deduction failures are non-fatal.
 *
 * Credit gating (auto-recharge + 402 short-circuit) lives in route handlers
 * via `ensureCreditsOrShortCircuit` — see `handleResearch` for the rationale.
 *
 * @returns `{ data }` on success, `{ error, status }` on failure.
 */
export async function handleArtistResearch(
  params: HandleArtistResearchParams,
): Promise<HandleArtistResearchResult> {
  const { artist, artistId, accountId, path, query, credits = 5 } = params;

  const resolved = artistId ? { id: artistId } : await resolveArtist(artist);
  if ("error" in resolved) return { error: resolved.error, status: 404 };

  const result = await fetchResearchProvider(path(resolved.id), query);
  if (result.status !== 200) {
    return { error: `Request failed with status ${result.status}`, status: result.status };
  }

  try {
    await recordCreditDeduction({
      accountId,
      creditsToDeduct: credits,
      source: "api",
    });
  } catch (error) {
    console.error("[research] credit deduction failed:", error);
  }

  return { data: result.data };
}
