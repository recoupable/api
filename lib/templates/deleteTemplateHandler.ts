import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateDeleteTemplateRequest } from "@/lib/templates/validateDeleteTemplateRequest";
import { deleteTemplate } from "@/lib/supabase/templates/deleteTemplate";

/**
 * Handler for DELETE /api/agents/templates/{id}.
 *
 * Permanently removes the template. Caller must be the template's
 * creator.
 *
 * @param request - The incoming request
 * @param params - Route params containing the template id
 * @returns A 200 NextResponse with `{ status: "success" }`, or an error.
 */
export async function deleteTemplateHandler(
  request: NextRequest,
  params: Promise<{ id: string }>,
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const validated = await validateDeleteTemplateRequest(request, id);
    if (validated instanceof NextResponse) return validated;

    const ok = await deleteTemplate(validated.templateId);
    if (!ok) {
      return NextResponse.json(
        { status: "error", error: "Failed to delete template" },
        { status: 500, headers: getCorsHeaders() },
      );
    }

    return NextResponse.json({ status: "success" }, { status: 200, headers: getCorsHeaders() });
  } catch (error) {
    console.error("[ERROR] deleteTemplateHandler:", error);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
