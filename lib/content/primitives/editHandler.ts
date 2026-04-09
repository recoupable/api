import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { triggerPrimitive } from "@/lib/trigger/triggerPrimitive";
import { validatePrimitiveBody } from "./validatePrimitiveBody";
import { editBodySchema } from "./schemas";
import { loadTemplate } from "@/lib/content/templates";

/**
 * PATCH /api/content
 *
 * @param request - Incoming request with media inputs and edit operations.
 * @returns JSON with the triggered run ID.
 */
export async function editHandler(request: NextRequest): Promise<NextResponse> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const validated = await validatePrimitiveBody(request, editBodySchema);
  if (validated instanceof NextResponse) return validated;

  try {
    let operations = validated.operations;

    if (!operations && validated.template) {
      const tpl = loadTemplate(validated.template);
      if (tpl?.edit.operations) {
        operations = tpl.edit.operations as typeof operations;
      }
    }

    const handle = await triggerPrimitive("create-render", {
      videoUrl: validated.video_url,
      audioUrl: validated.audio_url,
      operations,
      outputFormat: validated.output_format,
      accountId: authResult.accountId,
    });

    return NextResponse.json(
      { runId: handle.id, status: "triggered" },
      { status: 202, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("Failed to trigger edit:", error);
    return NextResponse.json(
      { status: "error", error: "Failed to trigger edit task" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
