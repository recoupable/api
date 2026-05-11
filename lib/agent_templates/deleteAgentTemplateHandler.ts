import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateDeleteAgentTemplateRequest } from "@/lib/agent_templates/validateDeleteAgentTemplateRequest";
import { deleteAgentTemplate } from "@/lib/supabase/agent_templates/deleteAgentTemplate";

/**
 * Handler for DELETE /api/agent-templates/{id}.
 *
 * Permanently removes the agent template. Caller must be the template's
 * creator.
 *
 * @param request - The incoming request
 * @param params - Route params containing the template id
 * @returns A 200 NextResponse with `{ status: "success" }`, or an error.
 */
export async function deleteAgentTemplateHandler(
  request: NextRequest,
  params: Promise<{ id: string }>,
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const validated = await validateDeleteAgentTemplateRequest(request, id);
    if (validated instanceof NextResponse) return validated;

    const ok = await deleteAgentTemplate(validated.templateId);
    if (!ok) {
      return NextResponse.json(
        { status: "error", error: "Failed to delete agent template" },
        { status: 500, headers: getCorsHeaders() },
      );
    }

    return NextResponse.json({ status: "success" }, { status: 200, headers: getCorsHeaders() });
  } catch (error) {
    console.error("[ERROR] deleteAgentTemplateHandler:", error);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
