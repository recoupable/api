import { type NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { successResponse } from "@/lib/networking/successResponse";
import { getAppleSongsByIsrc } from "@/lib/apple/getAppleSongsByIsrc";
import { validateGetAppleSongsRequest } from "@/lib/apple/validateGetAppleSongsRequest";

/**
 * GET /api/apple/songs
 *
 * Looks up recordings in the Apple Music catalog by ISRC. Returns one entry per
 * requested ISRC, so a recording Apple does not carry surfaces as
 * `found: false` rather than being omitted.
 *
 * @param request - The incoming HTTP request.
 * @returns The JSON response.
 */
export async function getAppleSongsHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateGetAppleSongsRequest(request);
    if (validated instanceof NextResponse) return validated;

    const { results, error } = await getAppleSongsByIsrc({
      isrcs: validated.isrcs,
      storefront: validated.storefront,
    });

    if (error || !results) {
      // Logged, never returned — the upstream message can name a credential.
      console.error("[ERROR] getAppleSongsHandler upstream:", error);
      return errorResponse("Failed to reach the Apple Music API", 500);
    }

    return successResponse({ storefront: validated.storefront, results });
  } catch (error) {
    console.error("[ERROR] getAppleSongsHandler:", error);
    return errorResponse("Internal server error", 500);
  }
}
