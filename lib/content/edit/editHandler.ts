import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { tasks } from "@trigger.dev/sdk";
import { loadTemplate } from "@/lib/content/templates";
import { validateEditContentBody } from "./validateEditContentBody";

/**
 * PATCH /api/content
 *
 * @param request - Incoming request with video URL and edit operations.
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

    const handle = await tasks.trigger("create-render", {
      ...validated,
      operations,
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
