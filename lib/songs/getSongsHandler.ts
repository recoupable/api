import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { errorResponse } from "@/lib/networking/errorResponse";
import { getSongsWithArtists } from "@/lib/songs/getSongsWithArtists";
import { validateGetSongsRequest } from "@/lib/songs/validateGetSongsRequest";

/**
 * Handler for GET /api/songs — returns songs with their associated artist
 * accounts, optionally filtered by `isrc` and/or `artist_account_id`.
 *
 * Authentication is required (`x-api-key` or `Authorization: Bearer`), but no
 * per-artist access check is applied — song metadata is DSP-public; see the
 * rationale in `validateGetSongsRequest`.
 *
 * Always returns a generic `"Internal server error"` string on 500 — never
 * surfaces the underlying error message.
 */
export async function getSongsHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateGetSongsRequest(request);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const result = await getSongsWithArtists(validated);

    return NextResponse.json(result, { status: 200, headers: getCorsHeaders() });
  } catch (error) {
    console.error("[ERROR] getSongsHandler:", error);
    return errorResponse("Internal server error", 500);
  }
}
