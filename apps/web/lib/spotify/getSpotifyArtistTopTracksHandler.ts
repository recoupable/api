import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateSpotifyArtistTopTracksQuery } from "@/lib/spotify/validateSpotifyArtistTopTracksQuery";
import generateAccessToken from "@/lib/spotify/generateAccessToken";
import getArtistTopTracks from "@/lib/spotify/getArtistTopTracks";

/**
 * Handler for Spotify artist top tracks endpoint.
 *
 * Query parameters:
 * - id (required): Spotify artist ID
 * - market (optional): Market code (e.g., "US")
 *
 * @param request - The request object containing query parameters.
 * @returns A NextResponse with Spotify artist top tracks data.
 */
export async function getSpotifyArtistTopTracksHandler(
  request: NextRequest,
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);

    const validatedQuery = validateSpotifyArtistTopTracksQuery(searchParams);
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

    const { data, error } = await getArtistTopTracks({
      ...validatedQuery,
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
        ...(data as unknown as Record<string, unknown>),
      },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    console.error("[ERROR] Error in Spotify artist top tracks:", error);
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
