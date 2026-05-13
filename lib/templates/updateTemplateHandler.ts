import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateUpdateTemplateRequest } from "@/lib/templates/validateUpdateTemplateRequest";
import { updateAgentTemplate } from "@/lib/supabase/agent_templates/updateAgentTemplate";
import { deleteAgentTemplateShares } from "@/lib/supabase/agent_template_shares/deleteAgentTemplateShares";
import { insertAgentTemplateShares } from "@/lib/supabase/agent_template_shares/insertAgentTemplateShares";
import { selectAgentTemplates } from "@/lib/supabase/agent_templates/selectAgentTemplates";
import type { TablesUpdate } from "@/types/database.types";

/**
 * Handler for PATCH /api/agents/templates/{id}.
 *
 * Applies a partial update to an template the caller owns. When
 * `share_emails` is provided, existing shares are wiped and re-inserted.
 */
export async function updateTemplateHandler(
  request: NextRequest,
  params: Promise<{ id: string }>,
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const validated = await validateUpdateTemplateRequest(request, id);
    if (validated instanceof NextResponse) return validated;

    const { templateId, accountId, body } = validated;

    const updates: TablesUpdate<"agent_templates"> = {};
    if (typeof body.title !== "undefined") updates.title = body.title;
    if (typeof body.description !== "undefined") updates.description = body.description;
    if (typeof body.prompt !== "undefined") updates.prompt = body.prompt;
    if (typeof body.tags !== "undefined") updates.tags = body.tags;
    if (typeof body.is_private !== "undefined") updates.is_private = body.is_private;

    if (Object.keys(updates).length > 0) {
      const updated = await updateAgentTemplate(templateId, updates);
      if (!updated) {
        return NextResponse.json(
          { status: "error", error: "Failed to update template" },
          { status: 500, headers: getCorsHeaders() },
        );
      }
    }

    // NOTE: delete-then-insert is not atomic. A real fix requires a Postgres
    // RPC; for now both helpers throw on DB error so the outer catch returns
    // a 500.
    if (typeof body.share_emails !== "undefined") {
      await deleteAgentTemplateShares(templateId);
      if (body.share_emails.length > 0) {
        await insertAgentTemplateShares(templateId, body.share_emails);
      }
    }

    const [template] = await selectAgentTemplates({ id: templateId }, accountId);

    return NextResponse.json(
      { status: "success", template: template ?? null },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("[ERROR] updateTemplateHandler:", error);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
