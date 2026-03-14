import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const spotifyArtistTopTracksQuerySchema = z.object({
  id: z.string().min(1, "id parameter is required"),
  market: z.string().optional(),
});

export type SpotifyArtistTopTracksQuery = z.infer<typeof spotifyArtistTopTracksQuerySchema>;

/**
 * Validates Spotify artist top tracks query parameters.
 *
 * @param searchParams - The URL search parameters to validate.
 * @returns A NextResponse with an error if validation fails, or the validated query parameters if validation passes.
 */
export function validateSpotifyArtistTopTracksQuery(
  searchParams: URLSearchParams,
): NextResponse | SpotifyArtistTopTracksQuery {
  const params = Object.fromEntries(searchParams.entries());

  const validationResult = spotifyArtistTopTracksQuerySchema.safeParse(params);

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
