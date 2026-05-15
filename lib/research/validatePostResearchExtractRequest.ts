import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { ensureCreditsOrShortCircuit } from "@/lib/credits/ensureCreditsOrShortCircuit";
import { CREDIT_AUTO_RECHARGE_FALLBACK_SUCCESS_URL } from "@/lib/credits/const";
import { errorResponse } from "@/lib/networking/errorResponse";

const bodySchema = z.object({
  urls: z.array(z.string().min(1)).min(1).max(10),
  objective: z.string().optional(),
  full_content: z.boolean().optional(),
});

export type ValidatedPostResearchExtractRequest = {
  accountId: string;
  urls: string[];
  objective?: string;
  full_content?: boolean;
};

/**
 * Validates `POST /api/research/extract` — auth + body (`urls` 1..10 required,
 * optional `objective`, `full_content`).
 */
export async function validatePostResearchExtractRequest(
  request: NextRequest,
): Promise<NextResponse | ValidatedPostResearchExtractRequest> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "Invalid request body", 400);
  }

  const short = await ensureCreditsOrShortCircuit({
    accountId: authResult.accountId,
    creditsToDeduct: 5 * parsed.data.urls.length,
    successUrl: CREDIT_AUTO_RECHARGE_FALLBACK_SUCCESS_URL,
  });
  if (short) return short;

  return { accountId: authResult.accountId, ...parsed.data };
}
