import { type NextRequest, NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { errorResponse } from "@/lib/networking/errorResponse";

export type ValidatedGetResearchSearchRequest = {
  accountId: string;
  q: string;
  type: string;
  limit: string;
  beta: string | undefined;
  platforms: string | undefined;
  offset: string | undefined;
};

/**
 * Validates `GET /api/research/search` — auth + required `q` query param, with
 * defaults for `type` ("artists") and `limit` ("10"). Also accepts the optional
 * Chartmetric pass-throughs: `beta` (enables the improved search engine),
 * `platforms` (comma-separated string, beta-only per Chartmetric docs), and
 * `offset` (numeric string for paging).
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

  return {
    accountId: authResult.accountId,
    q,
    type: searchParams.get("type") || "artists",
    limit: searchParams.get("limit") || "10",
    beta: searchParams.get("beta") ?? undefined,
    platforms: searchParams.get("platforms") ?? undefined,
    offset: searchParams.get("offset") ?? undefined,
  };
}
