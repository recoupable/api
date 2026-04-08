import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateGetArtistRequest } from "@/lib/artists/validateGetArtistRequest";
import { getArtistById } from "@/lib/artists/getArtistById";
import { validateAccountIdOverride } from "@/lib/auth/validateAccountIdOverride";

/**
 * Handler for retrieving a single artist detail by account ID.
 *
 * @param request - The incoming request
 * @param params - Route params containing the artist account ID
 * @returns A NextResponse with the artist payload or an error
 */
export async function getArtistHandler(
  request: NextRequest,
  params: Promise<{ id: string }>,
): Promise<NextResponse> {
  try {
    const { id } = await params;

    const validatedRequest = await validateGetArtistRequest(request, id);
    if (validatedRequest instanceof NextResponse) {
      return validatedRequest;
    }

    const accessResult = await validateAccountIdOverride({
      currentAccountId: validatedRequest.requesterAccountId,
      targetAccountId: validatedRequest.artistId,
    });
    if (accessResult instanceof NextResponse) {
      return accessResult;
    }

    const artist = await getArtistById(validatedRequest.artistId);

    if (!artist) {
      return NextResponse.json(
        {
          status: "error",
          error: "Artist not found",
        },
        {
          status: 404,
          headers: getCorsHeaders(),
        },
      );
    }

    return NextResponse.json(
      {
        artist,
      },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    console.error("[ERROR] getArtistHandler:", error);
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Internal server error",
      },
      {
        status: 500,
        headers: getCorsHeaders(),
      },
    );
  }
}
