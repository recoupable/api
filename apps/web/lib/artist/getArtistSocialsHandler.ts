import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getArtistSocials } from "@/lib/artist/getArtistSocials";
import { validateGetArtistSocialsRequest } from "@/lib/artist/validateGetArtistSocialsRequest";

/**
 * Handler for GET /api/artists/{id}/socials.
 *
 * Validates path params, optional `page`/`limit` query, and auth, then returns
 * the artist's social profiles with pagination metadata.
 *
 * @param request - The incoming request.
 * @param id - The artist account ID from the route params.
 * @returns A NextResponse with socials and pagination metadata.
 */
export async function getArtistSocialsHandler(
  request: NextRequest,
  id: string,
): Promise<NextResponse> {
  try {
    const validated = await validateGetArtistSocialsRequest(request, id);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const result = await getArtistSocials(validated);

    const statusCode = result.status === "success" ? 200 : 500;

    return NextResponse.json(result, {
      status: statusCode,
      headers: getCorsHeaders(),
    });
  } catch (error) {
    console.error("[ERROR] getArtistSocialsHandler error:", error);
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "An unknown error occurred",
        socials: [],
        pagination: {
          total_count: 0,
          page: 1,
          limit: 20,
          total_pages: 0,
        },
      },
      {
        status: 500,
        headers: getCorsHeaders(),
      },
    );
  }
}
