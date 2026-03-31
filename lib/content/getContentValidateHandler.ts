import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateGetContentValidateQuery } from "@/lib/content/validateGetContentValidateQuery";
import { getArtistContentReadiness } from "@/lib/content/getArtistContentReadiness";

/**
 * Handler for GET /api/content/validate.
 * NOTE: Phase 1 returns structural readiness scaffolding. Deep filesystem checks
 * are performed in the background task before spend-heavy steps.
 *
 * @param request - The incoming Next.js request with artist_account_id query param.
 * @returns A NextResponse containing readiness status, missing required files, and warnings.
 */
export async function getContentValidateHandler(request: NextRequest): Promise<NextResponse> {
  const validated = await validateGetContentValidateQuery(request);
  if (validated instanceof NextResponse) {
    return validated;
  }

  try {
    const readiness = await getArtistContentReadiness({
      accountId: validated.accountId,
      artistAccountId: validated.artistAccountId,
      artistSlug: validated.artistSlug,
    });

    const publicReadiness = {
      artist_account_id: readiness.artist_account_id,
      ready: readiness.ready,
      missing: readiness.missing,
      warnings: readiness.warnings,
    };

    return NextResponse.json(
      {
        status: "success",
        ...publicReadiness,
      },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("Failed to validate content readiness:", error);
    return NextResponse.json(
      {
        status: "error",
        error: "Failed to validate content readiness",
      },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
