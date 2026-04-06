import { type NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { deductCredits } from "@/lib/credits/deductCredits";
import { proxyToChartmetric } from "@/lib/research/proxyToChartmetric";

/**
 * Shared handler for non-artist-scoped research endpoints. Handles auth, credit deduction, and proxying to Chartmetric.
 *
 * @param request - incoming HTTP request
 * @param buildPath - returns the Chartmetric API path
 * @param getQueryParams - extracts query params from the request
 * @param transformResponse - reshapes the proxy response data
 * @param credits - credits to deduct (default 5)
 * @returns JSON response with data or error
 */
export async function handleResearchRequest(
  request: NextRequest,
  buildPath: () => string,
  getQueryParams?: (searchParams: URLSearchParams) => Record<string, string>,
  transformResponse?: (data: unknown) => unknown,
  credits: number = 5,
): Promise<NextResponse> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;
  const { accountId } = authResult;

  const { searchParams } = new URL(request.url);
  const path = buildPath();
  const queryParams = getQueryParams ? getQueryParams(searchParams) : undefined;
  const result = await proxyToChartmetric(path, queryParams);

  if (result.status !== 200) {
    return NextResponse.json(
      { status: "error", error: `Request failed with status ${result.status}` },
      { status: result.status, headers: getCorsHeaders() },
    );
  }

  try {
    await deductCredits({ accountId, creditsToDeduct: credits });
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
