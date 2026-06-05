import { type NextRequest, NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { ensureResearchCredits } from "@/lib/research/ensureResearchCredits";
import { errorResponse } from "@/lib/networking/errorResponse";

export type ValidatedGetResearchSearchRequest = {
  accountId: string;
  q: string;
  type: string;
  limit: string;
  offset: string | undefined;
};

/**
 * Validates `GET /api/research/search` — auth + required `q` query param, with
 * defaults for `type` ("artists") and `limit` ("10"). Optional `offset` for paging.
 *
 * @param request - The incoming HTTP request.
 */
export async function validateGetResearchSearchRequest(
  request: NextRequest,
): Promise<NextResponse | ValidatedGetResearchSearchRequest> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  if (!q) return errorResponse("q parameter is required", 400);

  const short = await ensureResearchCredits(authResult.accountId);
  if (short) return short;

  return {
    accountId: authResult.accountId,
    q,
    type: searchParams.get("type") || "artists",
    limit: searchParams.get("limit") || "10",
    offset: searchParams.get("offset") ?? undefined,
  };
}
