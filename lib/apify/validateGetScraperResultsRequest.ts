import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { checkIsAdmin } from "@/lib/admins/checkIsAdmin";
import { selectApifyScraperRuns } from "@/lib/supabase/apify_scraper_runs/selectApifyScraperRuns";

export const getScraperResultsParamsSchema = z.object({
  runId: z.string().min(1),
});

export type GetScraperResultsParams = z.infer<typeof getScraperResultsParamsSchema>;

/**
 * Authenticates the request, then validates the runId path param.
 *
 * Owner-or-admin (recoupable/chat#1840): admins may poll any run; other
 * accounts only runs they started (matched via apify_scraper_runs, written
 * at scrape start). Runs with no recorded owner — pre-tracking runs, or
 * runs started outside POST /api/socials/{id}/scrape — return 404 for
 * non-admin callers rather than leaking whether the run id exists.
 */
export async function validateGetScraperResultsRequest(
  request: NextRequest,
  runId: string,
): Promise<GetScraperResultsParams | NextResponse> {
  const auth = await validateAuthContext(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const parsed = getScraperResultsParamsSchema.safeParse({ runId });
  if (!parsed.success) {
    return NextResponse.json(
      { status: "error", error: "Missing or invalid runId parameter" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const isAdmin = await checkIsAdmin(auth.accountId);
  if (isAdmin) {
    return parsed.data;
  }

  const runs = await selectApifyScraperRuns({ runId: parsed.data.runId });
  const run = runs?.[0];

  if (!run) {
    return NextResponse.json(
      { status: "error", message: "Run not found" },
      { status: 404, headers: getCorsHeaders() },
    );
  }

  if (run.account_id !== auth.accountId) {
    return NextResponse.json(
      { status: "error", message: "Forbidden" },
      { status: 403, headers: getCorsHeaders() },
    );
  }

  return parsed.data;
}
