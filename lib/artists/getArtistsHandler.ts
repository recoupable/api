import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateArtistsQuery } from "@/lib/artists/validateArtistsQuery";
import { getArtists } from "@/lib/artists/getArtists";

/**
 * Handler for retrieving artists with organization filtering.
 *
 * Query parameters:
 * - accountId (required): The account's ID
 * - orgId (optional): Filter to artists in a specific organization
 * - personal (optional): Set to "true" to show only personal (non-org) artists
 *
 * @param request - The request object containing query parameters
 * @returns A NextResponse with artists data
 */
export async function getArtistsHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);

    const validatedQuery = validateArtistsQuery(searchParams);
    if (validatedQuery instanceof NextResponse) {
      return validatedQuery;
    }

    // Determine orgId filter: personal=true means null, orgId means specific org
    const orgIdFilter = validatedQuery.personal === "true" ? null : validatedQuery.orgId;

    const artists = await getArtists({
      accountId: validatedQuery.accountId,
      orgId: orgIdFilter,
    });

    return NextResponse.json(
      {
        status: "success",
        artists,
      },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    console.error("[ERROR] getArtistsHandler:", error);
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

