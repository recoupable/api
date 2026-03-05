import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateCreateContentBody } from "@/lib/content/validateCreateContentBody";
import { triggerCreateContent } from "@/lib/trigger/triggerCreateContent";
import { getArtistContentReadiness } from "@/lib/content/getArtistContentReadiness";

/**
 * Handler for POST /api/content/create.
 * Triggers a background content-creation run and returns a runId for polling.
 */
export async function createContentHandler(request: NextRequest): Promise<NextResponse> {
  const validated = await validateCreateContentBody(request);
  if (validated instanceof NextResponse) {
    return validated;
  }

  try {
    const readiness = await getArtistContentReadiness({
      accountId: validated.accountId,
      artistSlug: validated.artistSlug,
    });

    if (!readiness.ready) {
      return NextResponse.json(
        {
          error: `Artist '${validated.artistSlug}' is not ready for content creation`,
          ready: false,
          missing: readiness.missing,
        },
        {
          status: 400,
          headers: getCorsHeaders(),
        },
      );
    }

    const handle = await triggerCreateContent({
      accountId: validated.accountId,
      artistSlug: validated.artistSlug,
      template: validated.template,
      lipsync: validated.lipsync,
    });

    return NextResponse.json(
      {
        runId: handle.id,
        status: "triggered",
        artist: validated.artistSlug,
        template: validated.template,
        lipsync: validated.lipsync,
      },
      {
        status: 202,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to trigger content creation";
    return NextResponse.json(
      {
        status: "error",
        error: message,
      },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}

