import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { pinArtist } from "@/lib/artists/pinArtist";
import { validatePinArtistBody } from "@/lib/artists/validatePinArtistBody";

/**
 * Handler for POST /api/artists/pin.
 *
 * Updates the authenticated account's pinned state for an accessible artist.
 *
 * @param request - The incoming request
 * @returns A NextResponse with the pin result or an error
 */
export async function pinArtistHandler(request: NextRequest): Promise<NextResponse> {
  const validated = await validatePinArtistBody(request);
  if (validated instanceof NextResponse) {
    return validated;
  }

  try {
    await pinArtist(validated);

    return NextResponse.json(
      {
        success: true,
        artistId: validated.artistId,
        pinned: validated.pinned,
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
