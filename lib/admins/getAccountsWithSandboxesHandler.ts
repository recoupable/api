import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { checkIsAdmin } from "./checkIsAdmin";
import { selectAllAccountSandboxSummaries } from "@/lib/supabase/account_sandboxes/selectAllAccountSandboxSummaries";

/**
 * Handler for GET /api/admins/accounts-with-sandboxes.
 * Returns a list of all accounts that have created sandboxes,
 * with their name, total sandbox count, and last created timestamp.
 *
 * Requires admin authentication (Recoup org membership).
 *
 * @param request - The request object
 * @returns A NextResponse with { status, accounts }
 */
export async function getAccountsWithSandboxesHandler(
  request: NextRequest,
): Promise<NextResponse> {
  try {
    const auth = await validateAuthContext(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    const isAdmin = await checkIsAdmin(auth.accountId);
    if (!isAdmin) {
      return NextResponse.json(
        { status: "error", error: "Admin access required" },
        { status: 403, headers: getCorsHeaders() },
      );
    }

    const accounts = await selectAllAccountSandboxSummaries();

    return NextResponse.json(
      {
        status: "success",
        accounts,
      },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    console.error("[ERROR] getAccountsWithSandboxesHandler:", error);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
