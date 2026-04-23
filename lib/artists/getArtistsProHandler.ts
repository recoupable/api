import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getEnterpriseArtists } from "@/lib/enterprise/getEnterpriseArtists";
import { validateGetArtistsProRequest } from "@/lib/artists/validateGetArtistsProRequest";

export async function getArtistsProHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateGetArtistsProRequest(request);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const artists = await getEnterpriseArtists();

    return NextResponse.json(
      { status: "success", artists },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    // Never leak error.message — it can surface DB hosts / stack hints.
    console.error("[ERROR] getArtistsProHandler:", error);
    return NextResponse.json(
      { status: "error", artists: [], error: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
