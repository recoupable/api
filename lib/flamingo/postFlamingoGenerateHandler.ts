import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateFlamingoGenerateRequest } from "@/lib/flamingo/validateFlamingoGenerateRequest";
import { processAnalyzeMusicRequest } from "@/lib/flamingo/processAnalyzeMusicRequest";
import { FlamingoServiceError } from "@/lib/flamingo/FlamingoServiceError";
import { ensureCreditsOrShortCircuit } from "@/lib/credits/ensureCreditsOrShortCircuit";
import { FLAMINGO_BASE_CREDITS } from "@/lib/flamingo/creditsForFlamingoCall";

/**
 * Handler for POST /api/songs/analyze.
 *
 * Validates the request (JSON, auth, body, audio URL: see
 * `validateFlamingoGenerateRequest`), gates the balance on the base price
 * of the request (402 when short), then delegates to the shared
 * processAnalyzeMusicRequest domain function, which charges per model call.
 *
 * A rejection from the model service answers 502 with `upstream_status` and
 * `detail`; a full report whose every section failed answers 502 with
 * `failed`; one with some failed sections answers 200 with `status: "partial"`.
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
    short = await ensureCreditsOrShortCircuit({
      accountId,
      creditsToDeduct: FLAMINGO_BASE_CREDITS,
    });
  } catch (err) {
    console.error("[postFlamingoGenerateHandler] credit gate failed:", err);
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

  if (result.type === "error") {
    return NextResponse.json(
      { status: "error", error: result.error },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  if (result.type === "upstream_error") {
    return NextResponse.json(
      { status: "error", error: result.error, failed: result.failed },
      { status: 502, headers: getCorsHeaders() },
    );
  }

  const { type: _, ...data } = result;
  return NextResponse.json(
    { status: "success", ...data },
    { status: 200, headers: getCorsHeaders() },
  );
}
