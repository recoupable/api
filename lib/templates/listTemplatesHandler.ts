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
      const { data: rawProbe } = await (
        await import("@/lib/supabase/serverClient")
      ).default
        .from("accounts")
        .select("id, name, account_organization_ids!account_organization_ids_account_id_fkey ( organization_id )")
        .eq("id", SIDNEY);
      return NextResponse.json(
        { rawProbe, RECOUP_ORG_ID_const: (await import("@/lib/const")).RECOUP_ORG_ID },
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
