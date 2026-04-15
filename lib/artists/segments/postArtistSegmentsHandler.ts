import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createSegments } from "@/lib/segments/createSegments";
import { validatePostArtistSegmentsRequest } from "@/lib/artists/segments/validatePostArtistSegmentsRequest";

const NO_RESOURCE_ERROR_MESSAGES = new Set([
  "No social account found for this artist",
  "No fans found for this artist",
]);

/**
 * Handler for POST /api/artists/{id}/segments.
 *
 * Validates the request then delegates to the shared `createSegments` handler
 * that also powers the MCP `create_segments` tool.
 *
 * @param request - The incoming request object.
 * @param params - The route params containing the artist account ID.
 * @returns A NextResponse with the segment generation result envelope.
 */
export async function postArtistSegmentsHandler(
  request: NextRequest,
  params: Promise<{ id: string }>,
): Promise<NextResponse> {
  try {
    const { id } = await params;

    const validated = await validatePostArtistSegmentsRequest(request, id);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const result = await createSegments({
      artist_account_id: validated.artistId,
      prompt: validated.body.prompt,
    });

    if (result.success) {
      return NextResponse.json(
        {
          status: "success",
          segments_created: result.count,
          message: "Segments generated successfully.",
        },
        {
          status: 200,
          headers: getCorsHeaders(),
        },
      );
    }

    const message = result.message ?? "Failed to create segments";
    const feedback = "feedback" in result ? result.feedback : undefined;
    const isNoResourceError = NO_RESOURCE_ERROR_MESSAGES.has(message);
    const statusCode = isNoResourceError ? 409 : 500;

    return NextResponse.json(
      {
        status: "error",
        error: message,
        ...(feedback ? { feedback } : {}),
      },
      {
        status: statusCode,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    console.error("[ERROR] postArtistSegmentsHandler:", error);
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Internal server error",
      },
      {
        status: 500,
        headers: getCorsHeaders(),
      },
    );
  }
}
