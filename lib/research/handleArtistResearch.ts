import { NextResponse } from "next/server";
import { resolveArtist } from "@/lib/research/resolveArtist";
import { fetchChartmetric } from "@/lib/chartmetric/fetchChartmetric";
import { ensureCreditsOrShortCircuit } from "@/lib/credits/ensureCreditsOrShortCircuit";
import { deductCredits } from "@/lib/credits/deductCredits";
import { CREDIT_AUTO_RECHARGE_FALLBACK_SUCCESS_URL } from "@/lib/credits/const";

export type HandleArtistResearchParams = {
  artist: string;
  accountId: string;
  path: (cmId: number) => string;
  query?: Record<string, string>;
  /** Credits to charge on success. Defaults to 5. */
  credits?: number;
};

export type HandleArtistResearchResult =
  | NextResponse
  | { data: unknown }
  | { error: string; status: number };

/**
 * Resolves an artist to a Chartmetric ID, gates on credits up-front (auto-
 * recharge if short, 402 NextResponse if not), then proxies to the upstream
 * path. Successful gating deducts credits as part of `ensureCreditsOrShortCircuit`.
 *
 * @returns A 402 NextResponse on insufficient credits, `{ data }` on success,
 *   or `{ error, status }` on failure.
 */
export async function handleArtistResearch(
  params: HandleArtistResearchParams,
): Promise<HandleArtistResearchResult> {
  const { artist, accountId, path, query, credits = 5 } = params;

  const short = await ensureCreditsOrShortCircuit({
    accountId,
    creditsToDeduct: credits,
    successUrl: CREDIT_AUTO_RECHARGE_FALLBACK_SUCCESS_URL,
  });
  if (short) return short;

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
