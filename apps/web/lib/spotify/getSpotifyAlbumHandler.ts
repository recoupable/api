import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateSpotifyAlbumQuery } from "@/lib/spotify/validateSpotifyAlbumQuery";
import generateAccessToken from "@/lib/spotify/generateAccessToken";
import getAlbum from "@/lib/spotify/getAlbum";

/**
 * Handler for Spotify album endpoint.
 *
 * Query parameters:
 * - id (required): Spotify album ID
 * - market (optional): Market code (e.g., "US")
 *
 * @param request - The request object containing query parameters.
 * @returns A NextResponse with Spotify album data.
 */
export async function getSpotifyAlbumHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);

    const validatedQuery = validateSpotifyAlbumQuery(searchParams);
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

    const { album, error } = await getAlbum({
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
        ...(album as unknown as Record<string, unknown>),
      },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    console.error("[ERROR] Error in Spotify album:", error);
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
