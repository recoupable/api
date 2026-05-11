import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { getAccessibleAgentTemplatesForAccount } from "@/lib/agent_templates/getAccessibleAgentTemplatesForAccount";

/**
 * Handler for GET /api/agent-templates.
 *
 * Returns every agent template the authenticated account can see (own, public,
 * shared) with `creator`, `is_favourite`, and `shared_emails` embedded.
 */
export async function listAgentTemplatesHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const authResult = await validateAuthContext(request);
    if (authResult instanceof NextResponse) return authResult;

    const templates = await getAccessibleAgentTemplatesForAccount(authResult.accountId);

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
