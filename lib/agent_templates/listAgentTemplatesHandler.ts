import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { getAccessibleAgentTemplates } from "@/lib/supabase/agent_templates/getAccessibleAgentTemplates";

/**
 * Handler for GET /api/agent-templates.
 *
 * Returns every agent template the authenticated account can see (own + public
 * + shared) with the creator block, `is_favourite`, and `shared_emails`
 * embedded.
 *
 * @param request - The incoming request
 * @returns A 200 NextResponse with `{ status, templates }`, or an error.
 */
export async function listAgentTemplatesHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const authResult = await validateAuthContext(request);
    if (authResult instanceof NextResponse) return authResult;

    const templates = await getAccessibleAgentTemplates(authResult.accountId);

    return NextResponse.json(
      { status: "success", templates },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("[ERROR] listAgentTemplatesHandler:", error);
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
