import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { successResponse } from "@/lib/networking/successResponse";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { selectPlaycountSnapshots } from "@/lib/supabase/playcount_snapshots/selectPlaycountSnapshots";
import { validateGetRunsQuery } from "./validateGetRunsQuery";
import { toValuationRun } from "./toValuationRun";

/**
 * GET /api/runs
 *
 * The calling account's background runs, newest first — the generic status
 * resource behind in-flight valuation UI (chat#1973). A pure read: snapshot
 * rows mapped onto domain phases, no state of its own. `kind` selects the run
 * type (`valuation` is the only kind today); `limit` defaults to the latest
 * run. The account is always resolved from credentials, never from input.
 *
 * @returns `{ status, runs }` — empty runs when the account has never run one
 */
export async function getRunsHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = validateGetRunsQuery(request.nextUrl.searchParams);
    if (validated instanceof NextResponse) return validated;

    const authResult = await validateAuthContext(request);
    if (authResult instanceof NextResponse) return authResult;
    const { accountId } = authResult;

    // Throws on query error: a database failure must never read as "this
    // account has never run one" (chat#1965 conflation class) — it becomes
    // the 500 below instead of an empty run list.
    const snapshots = await selectPlaycountSnapshots({
      account: accountId,
      limit: validated.limit,
    });
    const runs = snapshots.map(snapshot => toValuationRun(snapshot));

    return successResponse({ runs });
  } catch (error) {
    console.error("Error fetching runs:", error);
    return errorResponse("Internal server error", 500);
  }
}
