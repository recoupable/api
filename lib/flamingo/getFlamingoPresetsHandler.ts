import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getPresetSummaries } from "@/lib/flamingo/presets";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

/**
 * Get Flamingo Presets Handler.
 *
 * @param request - Incoming HTTP request.
 * @returns - Computed result.
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
