import { type NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getCutoffMs } from "@/lib/admins/getCutoffMs";
import { getAgentSignups } from "@/lib/supabase/account_api_keys/getAgentSignups";
import { validateGetAgentSignupsQuery } from "./validateGetAgentSignupsQuery";

/**
 * Returns admin-only API-key metadata selected by the agent email prefix convention.
 *
 * @param request - Authenticated admin report request.
 * @returns Returned records and their count, or an auth/validation/server error.
 */
export async function getAgentSignupsHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const query = await validateGetAgentSignupsQuery(request);
    if (query instanceof NextResponse) return query;

    const cutoff = getCutoffMs(query.period);
    const signups = await getAgentSignups(
      cutoff === null ? undefined : new Date(cutoff).toISOString(),
    );
    return NextResponse.json(
      { status: "success", total: signups.length, signups },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("[ERROR] getAgentSignupsHandler:", error);
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
