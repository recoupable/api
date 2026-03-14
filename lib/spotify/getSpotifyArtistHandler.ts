import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateSpotifyArtistQuery } from "@/lib/spotify/validateSpotifyArtistQuery";
import generateAccessToken from "@/lib/spotify/generateAccessToken";
import getArtist from "@/lib/spotify/getArtist";

/**
 * Handler for Spotify artist endpoint.
 *
 * Query parameters:
 * - id (required): Spotify artist ID
 *
 * @param request - The request object containing query parameters.
 * @returns A NextResponse with Spotify artist data.
 */
export async function getSpotifyArtistHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);

    const validatedQuery = validateSpotifyArtistQuery(searchParams);
    if (validatedQuery instanceof NextResponse) {
      return validatedQuery;
    }

    const tokenResult = await generateAccessToken();

    if (!tokenResult || tokenResult.error || !tokenResult.access_token) {
      return NextResponse.json(
        {
          status: "error",
          error: "Failed to generate access token",
        },
        {
          status: 500,
          headers: getCorsHeaders(),
        },
      );
    }

    const { artist, error } = await getArtist(validatedQuery.id, tokenResult.access_token);

    if (error) {
      return NextResponse.json(
        {
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        },
        {
          status: 502,
          headers: getCorsHeaders(),
        },
      );
    }

    return NextResponse.json(
      {
        artist,
        error: null,
      },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    console.error("[ERROR] Error in Spotify artist:", error);
    return NextResponse.json(
      {
        artist: null,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      },
      {
        status: 500,
        headers: getCorsHeaders(),
      },
    );
  }
}
