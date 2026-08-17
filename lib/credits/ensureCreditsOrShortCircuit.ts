import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { checkCreditsAvailable } from "@/lib/credits/checkCreditsAvailable";
import { buildInsufficientCreditsResponse } from "@/lib/credits/buildInsufficientCreditsResponse";

export type EnsureCreditsParams = {
  accountId: string;
  creditsToDeduct: number;
};

/**
 * Handler-facing wrapper around `checkCreditsAvailable`. Either short-circuits
 * the request with a 402 Payment Required (callers `return short`), or returns
 * `null` to signal there are credits to spend (callers proceed with the work).
 *
 * Centralizes the response shape, status code, and CORS headers so every
 * credit-gated handler stays a one-import / two-line pattern.
 */
export async function ensureCreditsOrShortCircuit(
  params: EnsureCreditsParams,
): Promise<NextResponse | null> {
  const result = await checkCreditsAvailable(params);
  if (result.kind === "available") return null;

  return NextResponse.json(
    buildInsufficientCreditsResponse({
      remainingCredits: result.remainingCredits,
      requiredCredits: result.requiredCredits,
    }),
    { status: 402, headers: getCorsHeaders() },
  );
}
