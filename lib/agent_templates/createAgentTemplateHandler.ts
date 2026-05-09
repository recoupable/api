import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { validateCreateAgentTemplateBody } from "@/lib/agent_templates/validateCreateAgentTemplateBody";
import { insertAgentTemplate } from "@/lib/supabase/agent_templates/insertAgentTemplate";
import { insertAgentTemplateShares } from "@/lib/supabase/agent_template_shares/insertAgentTemplateShares";
import { getAgentTemplateWithDetails } from "@/lib/supabase/agent_templates/getAgentTemplateWithDetails";

/**
 * Handler for POST /api/agent-templates.
 *
 * Creates an agent template owned by the authenticated account. When
 * `is_private=true`, the supplied `share_emails` are resolved to accounts and
 * upserted into `agent_template_shares`.
 *
 * @param request - The incoming request
 * @returns A 201 NextResponse with `{ status, template }`, or an error.
 */
export async function createAgentTemplateHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await safeParseJson(request);
    const parsedBody = validateCreateAgentTemplateBody(body);
    if (parsedBody instanceof NextResponse) return parsedBody;

    const authResult = await validateAuthContext(request);
    if (authResult instanceof NextResponse) return authResult;

    const accountId = authResult.accountId;

    const inserted = await insertAgentTemplate({
      title: parsedBody.title,
      description: parsedBody.description,
      prompt: parsedBody.prompt,
      tags: parsedBody.tags,
      is_private: parsedBody.is_private,
      creator: accountId,
    });

    if (!inserted) {
      return NextResponse.json(
        { status: "error", error: "Failed to create agent template" },
        { status: 500, headers: getCorsHeaders() },
      );
    }

    if (parsedBody.is_private && parsedBody.share_emails.length > 0) {
      await insertAgentTemplateShares(inserted.id, parsedBody.share_emails);
    }

    const template = await getAgentTemplateWithDetails(inserted.id, accountId);

    return NextResponse.json(
      { status: "success", template },
      { status: 201, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("[ERROR] createAgentTemplateHandler:", error);
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
