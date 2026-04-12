import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { validateCreatePlanBody } from "./validateCreatePlanBody";
import { callElevenLabsMusic } from "./callElevenLabsMusic";
import { handleUpstreamError } from "./handleUpstreamError";

/**
 * Handler for POST /api/music/plan.
 * Creates a composition plan from a text prompt.
 * Free endpoint — does not consume ElevenLabs credits.
 *
 * @param request - The incoming request with a JSON body.
 * @returns The composition plan JSON or error JSON.
 */
export async function createPlanHandler(request: NextRequest): Promise<NextResponse> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const body = await safeParseJson(request);
  const validated = validateCreatePlanBody(body);
  if (validated instanceof NextResponse) return validated;

  try {
    const upstream = await callElevenLabsMusic("/v1/music/plan", validated);

    const errorResponse = await handleUpstreamError(upstream, "Plan creation");
    if (errorResponse) return errorResponse;

    const plan = await upstream.json();

    return NextResponse.json(
      { status: "success", ...plan },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("ElevenLabs plan error:", error);
    return NextResponse.json(
      { status: "error", error: "Plan creation failed" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
