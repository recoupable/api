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
 * Validates the request for GET /api/youtube/channel-info: parses the
 * `artist_account_id` query param and resolves the stored YouTube tokens
 * (refreshing them if expired).
 *
 * Returns a `NextResponse` on failure:
 * - 400 when the query param is missing.
 * - 200 + `success: false` when tokens cannot be resolved (re-auth required).
 *
 * @param request - The incoming request.
 * @returns A NextResponse with an error if validation fails, or the
 *          validated request payload (`artist_account_id` + `tokens`).
 */
export async function validateYouTubeChannelInfoRequest(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const params = Object.fromEntries(searchParams.entries());

  const result = youTubeChannelInfoRequestSchema.safeParse(params);

  if (!result.success) {
    return NextResponse.json(
      { success: false },
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
      { success: false, channels: null },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  }
}
