import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateSpotifySearchQuery } from "@/lib/spotify/validateSpotifySearchQuery";
import generateAccessToken from "@/lib/spotify/generateAccessToken";
import getSearch from "@/lib/spotify/getSearch";

/**
 * Handler for Spotify search endpoint.
 *
 * Query parameters:
 * - q (required): Search query string
 * - type (required): Type of search (e.g., "track", "album", "artist")
 * - market (optional): Market code (e.g., "US")
 * - limit (optional): Number of results to return
 * - offset (optional): Offset for pagination
 *
 * @param request - The request object containing query parameters.
 * @returns A NextResponse with Spotify search results.
 */
export async function getSpotifySearchHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);

    const validatedQuery = validateSpotifySearchQuery(searchParams);
    if (validatedQuery instanceof NextResponse) {
      return validatedQuery;
    }

    const tokenResult = await generateAccessToken();

    if (!tokenResult || tokenResult.error || !tokenResult.access_token) {
      return NextResponse.json(
        {
          status: "error",
        },
        {
          status: 500,
          headers: getCorsHeaders(),
        },
      );
    }

    const { data, error } = await getSearch({
      q: validatedQuery.q,
      type: validatedQuery.type,
      market: validatedQuery.market,
      limit: validatedQuery.limit,
      offset: validatedQuery.offset,
      accessToken: tokenResult.access_token,
    });

    if (error) {
      return NextResponse.json(
        {
          status: "error",
        },
        {
          status: 502,
          headers: getCorsHeaders(),
        },
      );
    }

    return NextResponse.json(
      {
        status: "success",
        ...data,
      },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    console.error("[ERROR] Error in Spotify search:", error);
    return NextResponse.json(
      {
        status: "error",
      },
      {
        status: 500,
        headers: getCorsHeaders(),
      },
    );
  }
}
