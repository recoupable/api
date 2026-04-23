import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { errorResponse } from "@/lib/networking/errorResponse";
import { selectSongsWithArtists } from "@/lib/supabase/songs/selectSongsWithArtists";
import { validateGetSongsRequest } from "@/lib/songs/validateGetSongsRequest";

/** GET /api/songs — songs with flattened artist accounts, optionally filtered by `isrc` / `artist_account_id`. */
export async function getSongsHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateGetSongsRequest(request);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const songs = await selectSongsWithArtists(validated);

    return NextResponse.json(
      { status: "success", songs },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("[ERROR] getSongsHandler:", error);
    return errorResponse("Internal server error", 500);
  }
}
