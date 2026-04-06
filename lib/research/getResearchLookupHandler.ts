import { type NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { deductCredits } from "@/lib/credits/deductCredits";
import { proxyToChartmetric } from "@/lib/research/proxyToChartmetric";

const SPOTIFY_ARTIST_REGEX = /spotify\.com\/artist\/([a-zA-Z0-9]+)/;

/**
 * GET /api/research/lookup
 *
 * Resolves a Spotify artist URL to Chartmetric IDs. Extracts the Spotify artist ID
 * from the given URL and calls Chartmetric's get-ids endpoint to retrieve all
 * cross-platform identifiers.
 *
 * @param request - Requires `url` query param containing a Spotify artist URL
 * @returns The JSON response.
 */
export async function getResearchLookupHandler(request: NextRequest): Promise<NextResponse> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;
  const { accountId } = authResult;

  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json(
      { status: "error", error: "url parameter is required" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const match = url.match(SPOTIFY_ARTIST_REGEX);
  if (!match) {
    return NextResponse.json(
      { status: "error", error: "url must be a valid Spotify artist URL" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const spotifyId = match[1];

  const result = await proxyToChartmetric(`/artist/spotify/${spotifyId}/get-ids`);

  if (result.status !== 200) {
    return NextResponse.json(
      { status: "error", error: "Lookup failed" },
      { status: result.status, headers: getCorsHeaders() },
    );
  }

  try {
    await deductCredits({ accountId, creditsToDeduct: 5 });
  } catch {
    // Credit deduction failed but data was fetched — log but don't block
  }

  const responseData = result.data;

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
