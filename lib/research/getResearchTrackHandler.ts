import { type NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { deductCredits } from "@/lib/credits/deductCredits";
import { fetchChartmetric } from "@/lib/chartmetric/fetchChartmetric";

/**
 * Track handler — searches Chartmetric for a track by name, then fetches full details for the top match.
 *
 * @param request - must include `q` query param
 * @returns JSON track details or error
 */
export async function getResearchTrackHandler(request: NextRequest): Promise<NextResponse> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;
  const { accountId } = authResult;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");

  if (!q) {
    return NextResponse.json(
      { status: "error", error: "q parameter is required" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const searchResult = await fetchChartmetric("/search", {
    q,
    type: "tracks",
    limit: "1",
  });

  if (searchResult.status !== 200) {
    return NextResponse.json(
      { status: "error", error: "Track search failed" },
      { status: searchResult.status, headers: getCorsHeaders() },
    );
  }

  const searchData = searchResult.data as { tracks?: Array<{ id: number }> };
  const tracks = searchData?.tracks;

  if (!tracks || tracks.length === 0) {
    return NextResponse.json(
      { status: "error", error: `No track found matching "${q}"` },
      { status: 404, headers: getCorsHeaders() },
    );
  }

  const trackId = tracks[0].id;
  const detailResult = await fetchChartmetric(`/track/${trackId}`);

  if (detailResult.status !== 200) {
    return NextResponse.json(
      { status: "error", error: "Failed to fetch track details" },
      { status: detailResult.status, headers: getCorsHeaders() },
    );
  }

  try {
    await deductCredits({ accountId, creditsToDeduct: 5 });
  } catch {
    // Credit deduction failed but data was fetched — log but don't block
  }

  return NextResponse.json(
    {
      status: "success",
      ...(typeof detailResult.data === "object" && detailResult.data !== null
        ? detailResult.data
        : { data: detailResult.data }),
    },
    { status: 200, headers: getCorsHeaders() },
  );
}
