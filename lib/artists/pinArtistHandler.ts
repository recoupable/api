import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { pinArtist } from "@/lib/artists/pinArtist";
import { validateArtistAccessRequest } from "@/lib/artists/validateArtistAccessRequest";

/**
 * Handler for POST or DELETE /api/artists/{id}/pin.
 *
 * Updates the authenticated account's pinned state for an accessible artist.
 *
 * @param request - The incoming request
 * @param params - Route params containing the artist account ID
 * @param pinned - Desired pinned state derived from the HTTP method
 * @returns A NextResponse with the pin result or an error
 */
export async function pinArtistHandler(
  request: NextRequest,
  params: Promise<{ id: string }>,
  pinned: boolean,
): Promise<NextResponse> {
  const { id } = await params;

  const validated = await validateArtistAccessRequest(request, id);
  if (validated instanceof NextResponse) {
    return validated;
  }

  try {
    await pinArtist({
      ...validated,
      pinned,
    });

    return NextResponse.json(
      {
        success: true,
        artistId: validated.artistId,
        pinned,
      },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    console.error("[ERROR] pinArtistHandler:", error);

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
