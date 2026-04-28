import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

export const youTubeChannelQuerySchema = z.object({
  artist_account_id: z
    .string({ message: "artist_account_id is required" })
    .min(1, "artist_account_id is required"),
});

export type YouTubeChannelQuery = z.infer<typeof youTubeChannelQuerySchema>;

/**
 * Validates query params for GET /api/youtube/channel-info.
 *
 * Returns the chat-parity 400 body when validation fails:
 * `{ success: false, error, tokenStatus: "missing_param" }`.
 *
 * @param request - The incoming request.
 * @returns A NextResponse with an error if validation fails, or the validated query.
 */
export function validateYouTubeChannelQuery(
  request: NextRequest,
): NextResponse | YouTubeChannelQuery {
  const { searchParams } = new URL(request.url);
  const params = Object.fromEntries(searchParams.entries());

  const result = youTubeChannelQuerySchema.safeParse(params);

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

  return result.data;
}
