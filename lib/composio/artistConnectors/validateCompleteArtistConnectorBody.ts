import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Schema for the complete artist connector request body.
 */
export const completeArtistConnectorBodySchema = z.object({
  artist_id: z
    .string({ message: "artist_id is required" })
    .uuid("artist_id must be a valid UUID"),
  toolkit_slug: z
    .string({ message: "toolkit_slug is required" })
    .min(1, "toolkit_slug cannot be empty (e.g., 'tiktok')"),
});

export type CompleteArtistConnectorBody = z.infer<typeof completeArtistConnectorBodySchema>;

/**
 * Validate the complete artist connector request body.
 *
 * @param body - The request body to validate
 * @returns The validated body or a NextResponse with error
 */
export function validateCompleteArtistConnectorBody(
  body: unknown,
): CompleteArtistConnectorBody | NextResponse {
  const result = completeArtistConnectorBodySchema.safeParse(body);

  if (!result.success) {
    const message = result.error.issues.map((i) => i.message).join(", ");
    return NextResponse.json(
      { error: message },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  return result.data;
}
