import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAddArtistToOrgRequest } from "@/lib/organizations/validateAddArtistToOrgRequest";
import { addArtistToOrganization } from "@/lib/supabase/artist_organization_ids/addArtistToOrganization";

/**
 * Handler for adding an artist to an organization.
 * This operation is idempotent - calling multiple times won't create duplicates.
 *
 * Body parameters:
 * - artistId (required): The artist's account ID
 * - organizationId (required): The organization's account ID
 *
 * @param request - The request object containing the body
 * @returns A NextResponse with the created record ID
 */
export async function addArtistToOrgHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateAddArtistToOrgRequest(request);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const { body } = validated;

    const id = await addArtistToOrganization(body.artistId, body.organizationId);

    if (!id) {
      return NextResponse.json(
        {
          status: "error",
          error: "Failed to add artist to organization",
        },
        {
          status: 500,
          headers: getCorsHeaders(),
        },
      );
    }

    return NextResponse.json(
      {
        status: "success",
        id,
      },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    console.error("[ERROR] addArtistToOrgHandler:", error);
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
