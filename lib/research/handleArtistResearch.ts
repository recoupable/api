import { type NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { deductCredits } from "@/lib/credits/deductCredits";
import { resolveArtist } from "@/lib/research/resolveArtist";
import { proxyToChartmetric } from "@/lib/research/proxyToChartmetric";

/**
 * Shared handler for artist-scoped research endpoints. Handles auth, artist resolution, credit deduction, and proxying.
 *
 * @param request - must include `artist` query param for Chartmetric resolution
 * @param buildPath - maps resolved Chartmetric ID to API path
 * @param getQueryParams - extracts additional query params from the request
 * @param transformResponse - reshapes the proxy response data
 * @returns JSON response with artist data or error
 */
export async function handleArtistResearch(
  request: NextRequest,
  buildPath: (cmId: number) => string,
  getQueryParams?: (searchParams: URLSearchParams) => Record<string, string>,
  transformResponse?: (data: unknown) => unknown,
): Promise<NextResponse> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;
  const { accountId } = authResult;

  const { searchParams } = new URL(request.url);
  const artist = searchParams.get("artist");

  if (!artist) {
    return NextResponse.json(
      { status: "error", error: "artist parameter is required" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const resolved = await resolveArtist(artist);
  if (resolved.error) {
    return NextResponse.json(
      { status: "error", error: resolved.error },
      { status: 404, headers: getCorsHeaders() },
    );
  }

  const path = buildPath(resolved.id);
  const queryParams = getQueryParams ? getQueryParams(searchParams) : undefined;
  const result = await proxyToChartmetric(path, queryParams);

  if (result.status !== 200) {
    return NextResponse.json(
      { status: "error", error: `Request failed with status ${result.status}` },
      { status: result.status, headers: getCorsHeaders() },
    );
  }

  try {
    await deductCredits({ accountId, creditsToDeduct: 5 });
  } catch {
    // Credit deduction failed but data was fetched — log but don't block
  }

  const responseData = transformResponse ? transformResponse(result.data) : result.data;

  return NextResponse.json(
    {
      status: "success",
      ...(typeof responseData === "object" && responseData !== null && !Array.isArray(responseData)
        ? responseData
        : { data: responseData }),
    },
    { status: 200, headers: getCorsHeaders() },
  );
}
