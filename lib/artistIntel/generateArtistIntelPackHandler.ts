import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { generateArtistIntelPack } from "@/lib/artistIntel/generateArtistIntelPack";
import { validateArtistIntelBody } from "@/lib/artistIntel/validateArtistIntelBody";

/**
 * Handler for POST /api/artists/intel.
 *
 * Generates a complete Artist Intelligence Pack by combining:
 * - Spotify metadata and top tracks
 * - MusicFlamingo NVIDIA AI audio analysis (genre, BPM, mood, audience profile)
 * - Perplexity web research
 * - AI-synthesized marketing copy (pitch email, social captions, press release)
 *
 * @param request - The incoming request with a JSON body containing artist_name.
 * @returns A NextResponse with the complete intelligence pack or an error.
 */
export async function generateArtistIntelPackHandler(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { status: "error", error: "Request body must be valid JSON" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const validated = validateArtistIntelBody(body);
  if (validated instanceof NextResponse) {
    return validated;
  }

  const result = await generateArtistIntelPack(validated.artist_name);

  if (result.type === "error") {
    return NextResponse.json(
      { status: "error", error: result.error },
      { status: 404, headers: getCorsHeaders() },
    );
  }

  return NextResponse.json(
    { status: "success", ...result.pack },
    { status: 200, headers: getCorsHeaders() },
  );
}
