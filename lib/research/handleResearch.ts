import { NextResponse } from "next/server";
import { fetchChartmetric } from "@/lib/chartmetric/fetchChartmetric";
import { ensureCreditsOrShortCircuit } from "@/lib/credits/ensureCreditsOrShortCircuit";
import { deductCredits } from "@/lib/credits/deductCredits";
import { CREDIT_AUTO_RECHARGE_FALLBACK_SUCCESS_URL } from "@/lib/credits/const";

export type HandleResearchParams = {
  accountId: string;
  path: string;
  query?: Record<string, string>;
  /** Credits to charge on success. Defaults to 5. */
  credits?: number;
};

export type HandleResearchResult =
  | NextResponse
  | { data: unknown }
  | { error: string; status: number };

/**
 * Proxies a non-artist-scoped research call to Chartmetric and gates on
 * credits up-front: if the account is short, an off-session auto-recharge
 * is attempted, otherwise the function returns a 402 NextResponse the route
 * can return directly. Successful gating runs the upstream call and deducts
 * credits as part of `ensureCreditsOrShortCircuit`.
 *
 * Auth is intentionally out of scope here — callers (validators) own that.
 *
 * @returns A 402 NextResponse on insufficient credits, `{ data }` on success,
 *   or `{ error, status }` on upstream failure.
 */
export async function handleResearch(params: HandleResearchParams): Promise<HandleResearchResult> {
  const { accountId, path, query, credits = 5 } = params;

  const short = await ensureCreditsOrShortCircuit({
    accountId,
    creditsToDeduct: credits,
    successUrl: CREDIT_AUTO_RECHARGE_FALLBACK_SUCCESS_URL,
  });
  if (short) return short;

  const result = await fetchChartmetric(path, query);
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
