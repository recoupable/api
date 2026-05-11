import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { selectAgentTemplates } from "@/lib/supabase/agent_templates/selectAgentTemplates";

/**
 * Handler for GET /api/agent-templates.
 *
 * Returns every agent template the authenticated account can see (own,
 * public, shared) fully shaped: `creator` flat with `is_admin`,
 * `is_favourite`, and `shared_emails` (only for templates the caller owns
 * and that are private).
 */
export async function listAgentTemplatesHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const authResult = await validateAuthContext(request);
    if (authResult instanceof NextResponse) return authResult;

    const accountId = authResult.accountId;
    const templates = await selectAgentTemplates({ accessibleTo: accountId }, accountId);

    return NextResponse.json(
      { status: "success", templates },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("[ERROR] listAgentTemplatesHandler:", error);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
