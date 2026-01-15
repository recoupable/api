import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateCreateArtistBody } from "@/lib/artists/validateCreateArtistBody";
import { createArtistInDb } from "@/lib/artists/createArtistInDb";

/**
 * Handler for creating a new artist via POST request.
 *
 * JSON body:
 * - name (required): The name of the artist to create
 * - account_id (required): The ID of the owner account (UUID)
 *
 * @param request - The request object containing JSON body
 * @returns A NextResponse with artist data or error
 */
export async function createArtistPostHandler(
  request: NextRequest,
): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Invalid JSON body" },
      {
        status: 400,
        headers: getCorsHeaders(),
      },
    );
  }

  const validatedBody = validateCreateArtistBody(body);
  if (validatedBody instanceof NextResponse) {
    return validatedBody;
  }

  try {
    const artist = await createArtistInDb(
      validatedBody.name,
      validatedBody.account_id,
    );

    if (!artist) {
      return NextResponse.json(
        { message: "Failed to create artist" },
        {
          status: 500,
          headers: getCorsHeaders(),
        },
      );
    }

    return NextResponse.json(
      { artist },
      {
        status: 201,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed";
    return NextResponse.json(
      { message },
      {
        status: 400,
        headers: getCorsHeaders(),
      },
    );
  }
}
