import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validateFlamingoGenerateBody } from "@/lib/flamingo/validateFlamingoGenerateBody";
import { processAnalyzeMusicRequest } from "@/lib/flamingo/processAnalyzeMusicRequest";
import { ensureCreditsOrShortCircuit } from "@/lib/credits/ensureCreditsOrShortCircuit";
import { minimumCreditsForAnalyzeRequest } from "@/lib/flamingo/minimumCreditsForAnalyzeRequest";

/**
 * Handler for POST /api/songs/analyze.
 *
 * Authenticates the request, validates the body, gates the balance on the
 * least the request can cost (402 when short), then delegates to the shared
 * processAnalyzeMusicRequest domain function, which charges per model call.
 *
 * @param request - The incoming request with a JSON body.
 * @returns A NextResponse with the model output or an error.
 */
export async function postFlamingoGenerateHandler(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { status: "error", error: "Request body must be valid JSON" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  // 1. Authenticate — supports both x-api-key and Authorization Bearer
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  // 2. Parse and validate body
  const validated = validateFlamingoGenerateBody(body);
  if (validated instanceof NextResponse) {
    return validated;
  }

  // 3. Gate on the smallest possible charge before any model call
  const short = await ensureCreditsOrShortCircuit({
    accountId: authResult.accountId,
    creditsToDeduct: minimumCreditsForAnalyzeRequest(validated),
  });
  if (short) return short;

  // 4. Process the analysis request
  let result;
  try {
    result = await processAnalyzeMusicRequest(validated, { accountId: authResult.accountId });
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

  // 5. Return flat response
  const { type: _, ...data } = result;
  return NextResponse.json(
    { status: "success", ...data },
    { status: 200, headers: getCorsHeaders() },
  );
}
