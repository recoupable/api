import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateGetAgentSignupsQuery } from "./validateGetAgentSignupsQuery";
import { getAgentSignups } from "@/lib/supabase/account_api_keys/getAgentSignups";
import { getCutoffDate } from "./getCutoffDate";

/**
 * Handler for GET /api/admins/agent-signups
 *
 * Returns API key sign-up records created by AI agents (identified by agent+ email prefix).
 * Supports period filtering for time-series analysis.
 *
 * Requires admin authentication.
 *
 * @param request - The request object
 * @returns A NextResponse with { status, total, signups }
 */
export async function getAgentSignupsHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const query = await validateGetAgentSignupsQuery(request);
    if (query instanceof NextResponse) {
      return query;
    }

    const cutoffDate = getCutoffDate(query.period);
    const signups = await getAgentSignups(cutoffDate);

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
