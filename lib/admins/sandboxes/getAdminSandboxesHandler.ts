import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAdminAuth } from "@/lib/admins/validateAdminAuth";
import { aggregateAccountSandboxStats } from "./aggregateAccountSandboxStats";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import { selectAccounts } from "@/lib/supabase/accounts/selectAccounts";

/**
 * Handler for GET /api/admins/sandboxes.
 *
 * Returns a list of accounts with their sandbox statistics:
 * - account_id
 * - account_email
 * - account_name (stored name, or null)
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
    const auth = await validateAdminAuth(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    const stats = await aggregateAccountSandboxStats();

    if (stats.length === 0) {
      return NextResponse.json(
        { status: "success", accounts: [] },
        { status: 200, headers: getCorsHeaders() },
      );
    }

    // Fetch names and emails in batches only after the admin gate and aggregation.
    const accountIds = stats.map(s => s.account_id);
    const [emailRows, accountRows] = await Promise.all([
      selectAccountEmails({ accountIds }),
      selectAccounts(accountIds),
    ]);

    const emailMap = new Map<string, string | null>(
      emailRows.filter(r => r.account_id !== null).map(r => [r.account_id as string, r.email]),
    );
    const nameMap = new Map(accountRows.map(row => [row.id, row.name]));

    const accounts = stats.map(s => ({
      account_id: s.account_id,
      account_email: emailMap.get(s.account_id) ?? null,
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
