import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateFlamingoGenerateRequest } from "@/lib/flamingo/validateFlamingoGenerateRequest";
import { processAnalyzeMusicRequest } from "@/lib/flamingo/processAnalyzeMusicRequest";
import { ensureCreditsOrShortCircuit } from "@/lib/credits/ensureCreditsOrShortCircuit";
import { minimumCreditsForAnalyzeRequest } from "@/lib/flamingo/minimumCreditsForAnalyzeRequest";
import { assertAnalyzeWithinPlan } from "@/lib/plans/assertAnalyzeWithinPlan";
import { PlanLimitError } from "@/lib/plans/PlanLimitError";

/**
 * Handler for POST /api/songs/analyze.
 *
 * Validates the request (JSON, auth, body, audio URL: see
 * `validateFlamingoGenerateRequest`), gates the plan's monthly analyze cap
 * (402 `plan_limit`), gates the balance on the base price of the request
 * (402 `insufficient_credits`), then delegates to the shared
 * processAnalyzeMusicRequest domain function, which charges per model call.
 *
 * @param request - The incoming request with a JSON body.
 * @returns A NextResponse with the model output or an error.
 */
export async function postFlamingoGenerateHandler(request: NextRequest): Promise<NextResponse> {
  const validated = await validateFlamingoGenerateRequest(request);
  if (validated instanceof NextResponse) return validated;
  const { accountId, body } = validated;

  let short: NextResponse | null;
  try {
    await assertAnalyzeWithinPlan({ accountId });
    short = await ensureCreditsOrShortCircuit({
      accountId,
      creditsToDeduct: minimumCreditsForAnalyzeRequest(body),
    });
  } catch (err) {
    if (err instanceof PlanLimitError) {
      return NextResponse.json(err.body, { status: 402, headers: getCorsHeaders() });
    }
    console.error("[postFlamingoGenerateHandler] plan or credit gate failed:", err);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
  if (short) return short;

  let result;
  try {
    result = await processAnalyzeMusicRequest(body, { accountId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Music analysis failed";
    return NextResponse.json(
      { status: "error", error: message },
      { status: 500, headers: getCorsHeaders() },
    );
  }

  if (result.type === "error") {
    return NextResponse.json(
      { status: "error", error: result.error },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const { type: _, ...data } = result;
  return NextResponse.json(
    { status: "success", ...data },
    { status: 200, headers: getCorsHeaders() },
  );
}
