import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateYouTubeTokens } from "@/lib/youtube/validateYouTubeTokens";

export const youTubeChannelInfoRequestSchema = z.object({
  artist_account_id: z
    .string({ message: "artist_account_id is required" })
    .min(1, "artist_account_id is required"),
});

/**
 * Validates GET /api/youtube/channel-info: parses the `artist_account_id`
 * query param and resolves the stored YouTube tokens (refreshing if
 * expired). On any token failure, returns 200 with `channels: null` so
 * clients can prompt re-auth without treating it as a network error.
 */
export async function validateYouTubeChannelInfoRequest(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const params = Object.fromEntries(searchParams.entries());

  const result = youTubeChannelInfoRequestSchema.safeParse(params);

  if (!result.success) {
    return NextResponse.json(
      { status: "error", message: result.error.issues[0].message },
      {
        status: 400,
        headers: getCorsHeaders(),
      },
    );
  }

  try {
    const tokens = await validateYouTubeTokens(result.data.artist_account_id);
    return { artist_account_id: result.data.artist_account_id, tokens };
  } catch (error) {
    console.error(
      `YouTube token validation/refresh failed for account ${result.data.artist_account_id}:`,
      error,
    );
    return NextResponse.json(
      { status: "success", channels: null },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  }
}
