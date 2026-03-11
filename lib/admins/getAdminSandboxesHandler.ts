import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { checkIsAdmin } from "./checkIsAdmin";
import { aggregateAccountSandboxStats } from "./aggregateAccountSandboxStats";
import { selectAccountsByIds } from "@/lib/supabase/accounts/selectAccounts";

/**
 * Handler for GET /api/admins/sandboxes.
 *
 * Returns a list of accounts with their sandbox statistics:
 * - account_id
 * - account_name
 * - total_sandboxes
 * - last_created_at
 *
 * Requires the caller to be a Recoup admin.
 *
 * @param request - The request object
 * @returns A NextResponse with the list of account sandbox stats or an error
 */
export async function getAdminSandboxesHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = await validateAuthContext(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    const isAdmin = await checkIsAdmin(auth.accountId);
    if (!isAdmin) {
      return NextResponse.json(
        { status: "error", message: "Forbidden" },
        { status: 403, headers: getCorsHeaders() },
      );
    }

    const stats = await aggregateAccountSandboxStats();

    if (stats.length === 0) {
      return NextResponse.json(
        { status: "success", accounts: [] },
        { status: 200, headers: getCorsHeaders() },
      );
    }

    // Fetch account names for all account IDs in a single query
    const accountIds = stats.map(s => s.account_id);
    const accountRows = await selectAccountsByIds(accountIds);

    const nameMap = new Map<string, string | null>(
      accountRows.map(a => [a.id, a.name]),
    );

    const accounts = stats.map(s => ({
      account_id: s.account_id,
      account_name: nameMap.get(s.account_id) ?? null,
      total_sandboxes: s.total_sandboxes,
      last_created_at: s.last_created_at,
    }));

    return NextResponse.json(
      { status: "success", accounts },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("[ERROR] getAdminSandboxesHandler:", error);
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
