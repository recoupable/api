import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const linkSpotifyArtistBodySchema = z.object({
  spotify_id: z.string({ message: "spotify_id is required" }).min(1, "spotify_id cannot be empty"),
  name: z.string().min(1, "name cannot be empty").optional(),
  account_id: z.uuid({ message: "account_id must be a valid UUID" }).optional(),
  organization_id: z.uuid({ message: "organization_id must be a valid UUID" }).optional(),
});

export type LinkSpotifyArtistBody = z.infer<typeof linkSpotifyArtistBodySchema>;

/**
 * Validates the request body for POST /api/artists/spotify-link.
 *
 * @param body - The parsed request body.
 * @returns A NextResponse with an error if validation fails, or the validated body.
 */
export function validateLinkSpotifyArtistBody(body: unknown): NextResponse | LinkSpotifyArtistBody {
  const result = linkSpotifyArtistBodySchema.safeParse(body);

  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      {
        status: "error",
        missing_fields: firstError.path,
        error: firstError.message,
      },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  return result.data;
}
