import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { validateRenderVideoBody } from "@/lib/render/validateRenderVideoBody";
import { triggerRenderVideo } from "@/lib/trigger/triggerRenderVideo";

/**
 * Handler for POST /api/video/render.
 *
 * Authenticates the request, validates the body, then triggers the
 * render-video background task on Trigger.dev. Returns immediately
 * with a run ID that can be polled via GET /api/tasks/runs.
 *
 * @param request - The incoming Next.js request.
 * @returns A NextResponse with { status: "processing", runId } on success,
 *          or an error response on failure.
 */
export async function renderVideoHandler(request: NextRequest): Promise<NextResponse> {
  // 1. Authenticate — supports x-api-key and Authorization Bearer
  const authResult = await validateAuthContext(request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { accountId } = authResult;

  // 2. Parse and validate the request body
  const body = await safeParseJson(request);
  const validated = validateRenderVideoBody(body);

  if (validated instanceof NextResponse) {
    return validated;
  }

  // 3. Trigger the render task on Trigger.dev
  try {
    const handle = await triggerRenderVideo({
      ...validated,
      accountId,
    });

    return NextResponse.json(
      { status: "processing", runId: handle.id },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to trigger video render";
    return NextResponse.json(
      { status: "error", error: message },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
