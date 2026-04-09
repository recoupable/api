import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { triggerPrimitive } from "@/lib/trigger/triggerPrimitive";
import { loadTemplate } from "@/lib/content/templates";
import { validateEditContentBody } from "./validateEditContentBody";

/**
 * PATCH /api/content
 *
 * @param request - Incoming request with media inputs and edit operations.
 * @returns JSON with the triggered run ID.
 */
export async function editHandler(request: NextRequest): Promise<NextResponse> {
  const validated = await validateEditContentBody(request);
  if (validated instanceof NextResponse) return validated;

  try {
    let operations = validated.operations;

    if (!operations && validated.template) {
      const template = loadTemplate(validated.template);
      if (template?.edit.operations) {
        operations = template.edit.operations as typeof operations;
      }
    }

    const handle = await triggerPrimitive("create-render", {
      videoUrl: validated.video_url,
      audioUrl: validated.audio_url,
      operations,
      outputFormat: validated.output_format,
      accountId: validated.accountId,
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
