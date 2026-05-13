import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateToggleFavoriteRequest } from "@/lib/templates/validateToggleFavoriteRequest";
import { insertAgentTemplateFavorite } from "@/lib/supabase/agent_template_favorites/insertAgentTemplateFavorite";
import { deleteAgentTemplateFavorite } from "@/lib/supabase/agent_template_favorites/deleteAgentTemplateFavorite";

/**
 * Handler for PUT /api/agents/templates/{id}/favorite.
 *
 * Idempotently toggles the caller's favorite status for the template:
 *   - `is_favourite=true` upserts the favorite row
 *   - `is_favourite=false` deletes it
 *
 * @param request - The incoming request
 * @param params - Route params containing the template id
 * @returns A 200 NextResponse with `{ status: "success" }`, or an error.
 */
export async function toggleTemplateFavoriteHandler(
  request: NextRequest,
  params: Promise<{ id: string }>,
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const validated = await validateToggleFavoriteRequest(request, id);
    if (validated instanceof NextResponse) return validated;

    const { templateId, accountId, isFavourite } = validated;

    const ok = isFavourite
      ? await insertAgentTemplateFavorite(templateId, accountId)
      : await deleteAgentTemplateFavorite(templateId, accountId);

    if (!ok) {
      return NextResponse.json(
        { status: "error", error: "Failed to toggle favorite" },
        { status: 500, headers: getCorsHeaders() },
      );
    }

    return NextResponse.json({ status: "success" }, { status: 200, headers: getCorsHeaders() });
  } catch (error) {
    console.error("[ERROR] toggleTemplateFavoriteHandler:", error);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
