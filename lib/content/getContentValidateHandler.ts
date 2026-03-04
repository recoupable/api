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
 * @param request
 */
export async function getContentValidateHandler(request: NextRequest): Promise<NextResponse> {
  const validated = await validateGetContentValidateQuery(request);
  if (validated instanceof NextResponse) {
    return validated;
  }

  try {
    const readiness = await getArtistContentReadiness({
      accountId: validated.accountId,
      artistSlug: validated.artistSlug,
    });

    return NextResponse.json(
      {
        status: "success",
        ...readiness,
      },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to validate content readiness";
    return NextResponse.json(
      {
        status: "error",
        error: message,
      },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
