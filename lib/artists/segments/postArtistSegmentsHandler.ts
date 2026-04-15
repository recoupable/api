import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAccountParams } from "@/lib/accounts/validateAccountParams";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { checkAccountArtistAccess } from "@/lib/artists/checkAccountArtistAccess";
import { selectAccounts } from "@/lib/supabase/accounts/selectAccounts";
import { createSegments } from "@/lib/segments/createSegments";
import { validatePostSegmentsBody } from "@/lib/artists/segments/validatePostSegmentsBody";

const NO_RESOURCE_ERROR_MESSAGES = new Set([
  "No social account found for this artist",
  "No fans found for this artist",
]);

/**
 * Handler for POST /api/artists/{id}/segments.
 *
 * Validates authentication and per-artist access, then delegates to the shared
 * `createSegments` handler that also powers the MCP `create_segments` tool.
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

    const validatedParams = validateAccountParams(id);
    if (validatedParams instanceof NextResponse) {
      return validatedParams;
    }

    const body = await safeParseJson(request);
    const validatedBody = validatePostSegmentsBody(body);
    if (validatedBody instanceof NextResponse) {
      return validatedBody;
    }

    const authResult = await validateAuthContext(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const artistId = validatedParams.id;
    const requesterAccountId = authResult.accountId;

    const existingArtist = await selectAccounts(artistId);
    if (!existingArtist.length) {
      return NextResponse.json(
        {
          status: "error",
          error: "Artist not found",
        },
        {
          status: 404,
          headers: getCorsHeaders(),
        },
      );
    }

    const hasAccess = await checkAccountArtistAccess(requesterAccountId, artistId);
    if (!hasAccess) {
      return NextResponse.json(
        {
          status: "error",
          error: "Unauthorized segment creation attempt",
        },
        {
          status: 403,
          headers: getCorsHeaders(),
        },
      );
    }

    const result = await createSegments({
      artist_account_id: artistId,
      prompt: validatedBody.prompt,
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
