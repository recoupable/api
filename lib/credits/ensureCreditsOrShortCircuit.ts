import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { autoRechargeOrFail } from "@/lib/credits/autoRechargeOrFail";
import { buildInsufficientCreditsResponse } from "@/lib/credits/buildInsufficientCreditsResponse";

export type EnsureCreditsParams = {
  accountId: string;
  creditsToDeduct: number;
  successUrl: string;
};

/**
 * Handler-facing wrapper around `autoRechargeOrFail`. Either short-circuits the
 * request with a 402 Payment Required (callers `return short`), or returns
 * `null` to signal the deduction succeeded (callers proceed with the work).
 *
 * Centralizes the response shape, status code, and CORS headers so every
 * credit-gated handler stays a one-import / two-line pattern.
 */
export async function ensureCreditsOrShortCircuit(
  params: EnsureCreditsParams,
): Promise<NextResponse | null> {
  const result = await autoRechargeOrFail(params);
  if (result.kind === "available") return null;

  return NextResponse.json(
    buildInsufficientCreditsResponse({
      remainingCredits: result.remainingCredits,
      requiredCredits: result.requiredCredits,
      checkoutUrl: result.checkoutUrl,
      declineReason: result.declineReason,
    }),
    { status: 402, headers: getCorsHeaders() },
  );
}
