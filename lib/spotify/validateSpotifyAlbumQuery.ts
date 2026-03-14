import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const spotifyAlbumQuerySchema = z.object({
  id: z.string().min(1, "id parameter is required"),
  market: z.string().optional(),
});

export type SpotifyAlbumQuery = z.infer<typeof spotifyAlbumQuerySchema>;

/**
 * Validates Spotify album query parameters.
 *
 * @param searchParams - The URL search parameters to validate.
 * @returns A NextResponse with an error if validation fails, or the validated query parameters if validation passes.
 */
export function validateSpotifyAlbumQuery(
  searchParams: URLSearchParams,
): NextResponse | SpotifyAlbumQuery {
  const params = Object.fromEntries(searchParams.entries());

  const validationResult = spotifyAlbumQuerySchema.safeParse(params);

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
