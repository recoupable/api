import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateCreateContentBody } from "@/lib/content/validateCreateContentBody";
import { triggerCreateContent } from "@/lib/trigger/triggerCreateContent";
import { getArtistContentReadiness } from "@/lib/content/getArtistContentReadiness";

/**
 * Handler for POST /api/content/create.
 * Always returns runIds array (KISS — one response shape for single and batch).
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

    const payload = {
      accountId: validated.accountId,
      artistSlug: validated.artistSlug,
      template: validated.template,
      lipsync: validated.lipsync,
      captionLength: validated.captionLength,
      upscale: validated.upscale,
      githubRepo: readiness.githubRepo,
    };

    // Always use allSettled — works for single and batch.
    const count = validated.batch;
    const results = await Promise.allSettled(
      Array.from({ length: count }, () => triggerCreateContent(payload)),
    );
    const runIds = results
      .filter(r => r.status === "fulfilled")
      .map(r => (r as PromiseFulfilledResult<{ id: string }>).value.id);
    const failedCount = results.filter(r => r.status === "rejected").length;

    return NextResponse.json(
      {
        runIds,
        status: "triggered",
        artist: validated.artistSlug,
        template: validated.template,
        lipsync: validated.lipsync,
        ...(failedCount > 0 && { failed: failedCount }),
      },
      { status: 202, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("Failed to trigger content creation:", error);
    return NextResponse.json(
      {
        status: "error",
        error: "Failed to trigger content creation",
      },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
