import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { deleteArtist } from "@/lib/artists/deleteArtist";
import { validateDeleteArtistRequest } from "@/lib/artists/validateDeleteArtistRequest";

/**
 * Handler for DELETE /api/artists/{id}.
 *
 * Removes the authenticated account's direct link to an artist. If that link
 * was the last remaining owner link, the artist account is deleted as well.
 *
 * @param request - The incoming request
 * @param params - Route params containing the artist account ID
 * @returns A NextResponse with the delete result or an error
 */
export async function deleteArtistHandler(
  request: NextRequest,
  params: Promise<{ id: string }>,
): Promise<NextResponse> {
  try {
    const { id } = await params;

    const validated = await validateDeleteArtistRequest(request, id);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const result = await deleteArtist(validated);

    if (!result.ok && result.code === "not_found") {
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

    if (!result.ok && result.code === "forbidden") {
      return NextResponse.json(
        {
          status: "error",
          error: "Unauthorized delete attempt",
        },
        {
          status: 403,
          headers: getCorsHeaders(),
        },
      );
    }

    return NextResponse.json(
      {
        success: true,
        artistId: result.artistId,
      },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    console.error("[ERROR] deleteArtistHandler:", error);
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
