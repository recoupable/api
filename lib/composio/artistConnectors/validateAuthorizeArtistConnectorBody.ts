import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const authorizeArtistConnectorBodySchema = z.object({
  artist_id: z
    .string({ message: "artist_id is required" })
    .uuid("artist_id must be a valid UUID"),
  connector: z
    .string({ message: "connector is required" })
    .min(1, "connector cannot be empty (e.g., 'tiktok')"),
});

export type AuthorizeArtistConnectorBody = z.infer<
  typeof authorizeArtistConnectorBodySchema
>;

/**
 * Validates request body for POST /api/artist-connectors/authorize.
 *
 * @param body - The request body
 * @returns A NextResponse with an error if validation fails, or the validated body if validation passes.
 */
export function validateAuthorizeArtistConnectorBody(
  body: unknown,
): NextResponse | AuthorizeArtistConnectorBody {
  const result = authorizeArtistConnectorBodySchema.safeParse(body);

  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      {
        error: firstError.message,
      },
      {
        status: 400,
        headers: getCorsHeaders(),
      },
    );
  }

  return result.data;
}
