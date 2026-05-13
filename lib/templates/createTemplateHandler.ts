import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateCreateTemplateRequest } from "@/lib/templates/validateCreateTemplateRequest";
import { insertAgentTemplate } from "@/lib/supabase/agent_templates/insertAgentTemplate";
import { insertAgentTemplateShares } from "@/lib/supabase/agent_template_shares/insertAgentTemplateShares";
import { selectAgentTemplates } from "@/lib/supabase/agent_templates/selectAgentTemplates";

/**
 * Handler for POST /api/agents/templates.
 *
 * Creates a template owned by the authenticated account. When `is_private`
 * is true, supplied `share_emails` are resolved to accounts and upserted
 * into template_shares.
 */
export async function createTemplateHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateCreateTemplateRequest(request);
    if (validated instanceof NextResponse) return validated;

    const { accountId, body } = validated;

    const inserted = await insertAgentTemplate({
      title: body.title,
      description: body.description,
      prompt: body.prompt,
      tags: body.tags,
      is_private: body.is_private,
      creator: accountId,
    });

    if (!inserted) {
      return NextResponse.json(
        { status: "error", error: "Failed to create template" },
        { status: 500, headers: getCorsHeaders() },
      );
    }

    if (body.is_private && body.share_emails.length > 0) {
      await insertAgentTemplateShares(inserted.id, body.share_emails);
    }

    const [template] = await selectAgentTemplates({ id: inserted.id }, accountId);

    return NextResponse.json(
      { status: "success", template: template ?? null },
      { status: 201, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("[ERROR] createTemplateHandler:", error);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
