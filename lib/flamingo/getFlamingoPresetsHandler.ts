import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getPresetSummaries } from "@/lib/flamingo/presets";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

/**
 * Handler for GET /api/songs/analyze/presets.
 *
 * Returns a list of all available analysis presets.
 * Requires authentication via x-api-key header or Authorization bearer token.
 *
 * @param request
 * @returns A NextResponse with the list of available presets.
 */
export async function getFlamingoPresetsHandler(request: NextRequest): Promise<NextResponse> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const presets = getPresetSummaries();

  return NextResponse.json(
    {
      status: "success",
      presets,
    },
    {
      status: 200,
      headers: getCorsHeaders(),
    },
  );
}
