import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateGetPrivyLoginsQuery } from "./validateGetPrivyLoginsQuery";
import { fetchPrivyLogins } from "./fetchPrivyLogins";

/**
 * Handler for GET /api/admins/privy
 *
 * Returns Privy login statistics for the requested time period.
 * Period defaults to "daily" (last 24 hours). Supports "weekly" (7 days) and "monthly" (30 days).
 *
 * Each login represents a user account created in Privy (i.e., their first authentication).
 * Results include a total count and the full, unmodified user objects from Privy.
 *
 * Requires admin authentication.
 *
 * @param request - The request object
 * @returns A NextResponse with { status: "success", total: number, logins: PrivyUser[] }
 */
export async function getPrivyLoginsHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const query = await validateGetPrivyLoginsQuery(request);
    if (query instanceof NextResponse) {
      return query;
    }

    const logins = await fetchPrivyLogins(query.period);

    return NextResponse.json(
      { status: "success", total: logins.length, logins },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("[ERROR] getPrivyLoginsHandler:", error);
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
