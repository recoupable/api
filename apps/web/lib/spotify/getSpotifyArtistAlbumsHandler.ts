import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateSpotifyArtistAlbumsQuery } from "@/lib/spotify/validateSpotifyArtistAlbumsQuery";
import generateAccessToken from "@/lib/spotify/generateAccessToken";
import getArtistAlbums from "@/lib/spotify/getArtistAlbums";

/**
 * Handler for Spotify artist albums endpoint.
 *
 * Query parameters:
 * - id (required): Spotify artist ID
 * - include_groups (optional): Comma-separated list of album types to include
 * - market (optional): Market code (e.g., "US")
 * - limit (optional): Number of results to return
 * - offset (optional): Offset for pagination
 *
 * @param request - The request object containing query parameters.
 * @returns A NextResponse with Spotify artist albums data.
 */
export async function getSpotifyArtistAlbumsHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);

    const validatedQuery = validateSpotifyArtistAlbumsQuery(searchParams);
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

    const { data, error } = await getArtistAlbums({
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
        ...data,
      },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    console.error("[ERROR] Error in Spotify artist albums:", error);
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
