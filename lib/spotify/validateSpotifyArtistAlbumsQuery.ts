import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const spotifyArtistAlbumsQuerySchema = z.object({
  id: z.string().min(1, "id parameter is required"),
  include_groups: z.string().optional(),
  market: z.string().optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
});

export type SpotifyArtistAlbumsQuery = z.infer<typeof spotifyArtistAlbumsQuerySchema>;

/**
 * Validates Spotify artist albums query parameters.
 *
 * @param searchParams - The URL search parameters to validate.
 * @returns A NextResponse with an error if validation fails, or the validated query parameters if validation passes.
 */
export function validateSpotifyArtistAlbumsQuery(
  searchParams: URLSearchParams,
): NextResponse | SpotifyArtistAlbumsQuery {
  const params = Object.fromEntries(searchParams.entries());

  const validationResult = spotifyArtistAlbumsQuerySchema.safeParse(params);

  if (!validationResult.success) {
    const firstError = validationResult.error.issues[0];
    return NextResponse.json(
      {
        status: "error",
        missing_fields: firstError.path,
        error: firstError.message,
      },
      {
        status: 400,
        headers: getCorsHeaders(),
      },
    );
  }

  return validationResult.data;
}
