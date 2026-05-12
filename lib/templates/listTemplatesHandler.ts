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

    // TEMP DEBUG
    if (request.nextUrl.searchParams.get("debug") === "raw") {
      const SIDNEY = "848cd58d-700f-4b38-ab4c-d9f526402e3c";
      const { RECOUP_ORG_ID } = await import("@/lib/const");
      const supa = (await import("@/lib/supabase/serverClient")).default;
      const [direct, all, recoupMembers] = await Promise.all([
        supa
          .from("account_organization_ids")
          .select("*")
          .eq("account_id", SIDNEY)
          .eq("organization_id", RECOUP_ORG_ID),
        supa.from("account_organization_ids").select("*").eq("account_id", SIDNEY),
        supa
          .from("account_organization_ids")
          .select("account_id")
          .eq("organization_id", RECOUP_ORG_ID)
          .limit(10),
      ]);
      return NextResponse.json(
        {
          RECOUP_ORG_ID_const: RECOUP_ORG_ID,
          sidney_recoup_row: direct.data,
          sidney_all_orgs: all.data,
          recoup_members_sample: recoupMembers.data,
        },
        { headers: getCorsHeaders() },
      );
    }

    return NextResponse.json(
      { status: "success", templates },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("[ERROR] listTemplatesHandler:", error);
    // TEMP DEBUG — echo full error so curl can read the postgrest message.
    // Remove before merge.
    const debug = request.nextUrl.searchParams.get("debug") === "1";
    return NextResponse.json(
      {
        status: "error",
        error: "Internal server error",
        ...(debug
          ? {
              debug: {
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
              },
            }
          : {}),
      },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
