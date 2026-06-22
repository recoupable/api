import { NextRequest } from "next/server";
import { selectCreditsUsage } from "@/lib/supabase/credits_usage/selectCreditsUsage";

/**
 * GET /api/credits/get?accountId=<id>
 *
 * Returns the credits usage record for the given account.
 * Copied from the chat codebase as a lightweight read-only endpoint.
 */
export async function GET(req: NextRequest) {
  const accountId = req.nextUrl.searchParams.get("accountId");

  if (!accountId) {
    return Response.json({ message: "accountId is required" }, { status: 400 });
  }

  try {
    const creditsUsage = await selectCreditsUsage({ account_id: accountId });
    const data = creditsUsage.length > 0 ? creditsUsage[0] : null;
    return Response.json({ data }, { status: 200 });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "failed";
    return Response.json({ message }, { status: 400 });
  }
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
