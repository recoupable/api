import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { ensureCreditsOrShortCircuit } from "@/lib/credits/ensureCreditsOrShortCircuit";
import { errorResponse } from "@/lib/networking/errorResponse";
import { usdToCredits } from "@/lib/credits/usdToCredits";
import { PRICES_USD } from "@/lib/credits/pricesUsd";

const bodySchema = z.object({
  query: z.string().min(1, "query is required"),
});

export type ValidatedPostResearchDeepRequest = {
  accountId: string;
  query: string;
};

/**
 * Validates `POST /api/research/deep` — auth + body (`query` required) +
 * 25-credit budget (deep research is expensive). A short balance returns a
 * 402 NextResponse with a `checkoutUrl`; the gate never charges a card.
 */
export async function validatePostResearchDeepRequest(
  request: NextRequest,
): Promise<NextResponse | ValidatedPostResearchDeepRequest> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "Invalid request body", 400);
  }

  const short = await ensureCreditsOrShortCircuit({
    accountId: authResult.accountId,
    creditsToDeduct: usdToCredits(PRICES_USD.researchDeep),
  });
  if (short) return short;

  return { accountId: authResult.accountId, query: parsed.data.query };
}
