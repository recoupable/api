import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateFlamingoGenerateBatchRequest } from "@/lib/flamingo/validateFlamingoGenerateBatchRequest";
import { processAnalyzeMusicBatchRequest } from "@/lib/flamingo/processAnalyzeMusicBatchRequest";
import { FlamingoServiceError } from "@/lib/flamingo/FlamingoServiceError";
import { FLAMINGO_BASE_CREDITS } from "@/lib/flamingo/creditsForFlamingoCall";
import { ensureCreditsOrShortCircuit } from "@/lib/credits/ensureCreditsOrShortCircuit";

/**
 * Handler for POST /api/songs/analyze/batch.
 *
 * Validates the request (JSON, auth, body, audio URL: see
 * `validateFlamingoGenerateBatchRequest`), gates the balance on one base
 * price (402 when short: a batch owes the base once, whatever its size),
 * then delegates to `processAnalyzeMusicBatchRequest`, which charges once
 * after the batch succeeds.
 *
 * A rejection from the model service answers 502 with `upstream_status` and
 * `detail`; any other failure answers 500.
 *
 * @param request - The incoming request with a JSON body.
 * @returns A NextResponse with every prompt's answer or an error.
 */
export async function postFlamingoGenerateBatchHandler(
  request: NextRequest,
): Promise<NextResponse> {
  const validated = await validateFlamingoGenerateBatchRequest(request);
  if (validated instanceof NextResponse) return validated;
  const { accountId, body } = validated;

  let short: NextResponse | null;
  try {
    short = await ensureCreditsOrShortCircuit({
      accountId,
      creditsToDeduct: FLAMINGO_BASE_CREDITS,
    });
  } catch (err) {
    console.error("[postFlamingoGenerateBatchHandler] credit gate failed:", err);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
  if (short) return short;

  try {
    const { answers, elapsed_seconds, prompts } = await processAnalyzeMusicBatchRequest(body, {
      accountId,
    });
    return NextResponse.json(
      { status: "success", answers, elapsed_seconds, prompts },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (err) {
    if (err instanceof FlamingoServiceError) {
      return NextResponse.json(
        { status: "error", error: err.message, upstream_status: err.status, detail: err.detail },
        { status: 502, headers: getCorsHeaders() },
      );
    }
    const message = err instanceof Error ? err.message : "Music analysis failed";
    return NextResponse.json(
      { status: "error", error: message },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
