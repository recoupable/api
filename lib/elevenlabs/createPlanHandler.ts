import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validateCreatePlanBody } from "./validateCreatePlanBody";
import { callElevenLabsMusic } from "./callElevenLabsMusic";

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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { status: "error", error: "Request body must be valid JSON" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const validated = validateCreatePlanBody(body);
  if (validated instanceof NextResponse) return validated;

  try {
    const upstream = await callElevenLabsMusic("/v1/music/plan", validated);

    if (!upstream.ok) {
      const errorText = await upstream.text().catch(() => "Unknown error");
      console.error(`ElevenLabs plan returned ${upstream.status}: ${errorText}`);
      return NextResponse.json(
        { status: "error", error: `Plan creation failed (status ${upstream.status})` },
        { status: upstream.status >= 500 ? 502 : upstream.status, headers: getCorsHeaders() },
      );
    }

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
