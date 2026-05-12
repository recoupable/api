import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { selectTemplates } from "@/lib/supabase/templates/selectTemplates";

/**
 * Handler for GET /api/agents/templates.
 *
 * Returns every template the authenticated account can see (own,
 * public, shared) fully shaped: `creator` flat with `is_admin`,
 * `is_favourite`, and `shared_emails` (only for templates the caller owns
 * and that are private).
 */
export async function listTemplatesHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const authResult = await validateAuthContext(request);
    if (authResult instanceof NextResponse) return authResult;

    const accountId = authResult.accountId;
    const templates = await selectTemplates({ accessibleTo: accountId }, accountId);

    return NextResponse.json(
      { status: "success", templates },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("[ERROR] listTemplatesHandler:", error);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
