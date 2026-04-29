import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateYouTubeTokens } from "@/lib/youtube/validateYouTubeTokens";
import type { YouTubeTokensRow } from "@/lib/youtube/validateYouTubeTokens";

export const youTubeChannelInfoRequestSchema = z.object({
  artist_account_id: z
    .string({ message: "artist_account_id is required" })
    .min(1, "artist_account_id is required"),
});

export type ValidatedYouTubeChannelInfoRequest = {
  artist_account_id: string;
  tokens: YouTubeTokensRow;
};

/**
 * Validates the request for GET /api/youtube/channel-info: parses the
 * `artist_account_id` query param and resolves the stored YouTube tokens
 * (refreshing them if expired). Mirrors chat's response shapes 1:1.
 *
 * Returns a `NextResponse` on failure:
 * - 400 + `tokenStatus: "missing_param"` when the query param is missing.
 * - 200 + `tokenStatus: "invalid"` when tokens cannot be resolved.
 *
 * @param request - The incoming request.
 * @returns A NextResponse with an error if validation fails, or the
 *          validated request payload (`artist_account_id` + `tokens`).
 */
export async function validateYouTubeChannelInfoRequest(
  request: NextRequest,
): Promise<NextResponse | ValidatedYouTubeChannelInfoRequest> {
  const { searchParams } = new URL(request.url);
  const params = Object.fromEntries(searchParams.entries());

  const result = youTubeChannelInfoRequestSchema.safeParse(params);

  if (!result.success) {
    return NextResponse.json(
      {
        success: false,
        error: "Missing artist_account_id parameter",
        tokenStatus: "missing_param",
      },
      {
        status: 400,
        headers: getCorsHeaders(),
      },
    );
  }

  const tokens = await validateYouTubeTokens(result.data.artist_account_id);
  if (!tokens) {
    return NextResponse.json(
      {
        success: false,
        error: "YouTube authentication required",
        tokenStatus: "invalid",
        channels: null,
      },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  }

  return { artist_account_id: result.data.artist_account_id, tokens };
}
