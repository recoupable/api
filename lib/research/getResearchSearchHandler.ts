import { type NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { deductCredits } from "@/lib/credits/deductCredits";
import { fetchChartmetric } from "@/lib/research/fetchChartmetric";

/**
 * Search handler — looks up artists/tracks/albums by name via Chartmetric.
 *
 * @param request - must include `q` query param
 * @returns JSON search results or error
 */
export async function getResearchSearchHandler(request: NextRequest): Promise<NextResponse> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;
  const { accountId } = authResult;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const type = searchParams.get("type") || "artists";
  const limit = searchParams.get("limit") || "10";

  if (!q) {
    return NextResponse.json(
      { status: "error", error: "q parameter is required" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const result = await fetchChartmetric("/search", { q, type, limit });

  if (result.status !== 200) {
    return NextResponse.json(
      { status: "error", error: "Search failed" },
      { status: result.status, headers: getCorsHeaders() },
    );
  }

  try {
    await deductCredits({ accountId, creditsToDeduct: 5 });
  } catch {
    // Credit deduction failed but data was fetched — log but don't block
  }

  const data = result.data as { artists?: unknown[]; tracks?: unknown[]; albums?: unknown[] };
  const results = data?.artists || data?.tracks || data?.albums || [];

  return NextResponse.json(
    { status: "success", results },
    { status: 200, headers: getCorsHeaders() },
  );
}
