import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { triggerPrimitive } from "@/lib/trigger/triggerPrimitive";
import { validatePrimitiveBody } from "./validatePrimitiveBody";
import { createRenderBodySchema } from "./schemas";

/**
 * POST /api/content/create/render
 * Triggers the create-render Trigger.dev task (requires ffmpeg).
 *
 * @param request - Incoming request with video, audio, and text parameters.
 * @returns JSON with the triggered run ID.
 */
export async function createRenderHandler(request: NextRequest): Promise<NextResponse> {
  const validated = await validatePrimitiveBody(request, createRenderBodySchema);
  if (validated instanceof NextResponse) return validated;

  try {
    const handle = await triggerPrimitive("create-render", {
      ...(validated.data as Record<string, unknown>),
      accountId: validated.accountId,
    });

    return NextResponse.json(
      { runId: handle.id, status: "triggered" },
      { status: 202, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("Failed to trigger create-render:", error);
    return NextResponse.json(
      { status: "error", error: "Failed to trigger render task" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
