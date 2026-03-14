import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const spotifySearchQuerySchema = z.object({
  q: z.string().min(1, "q parameter is required"),
  type: z.string().min(1, "type parameter is required"),
  market: z.string().optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
});

export type SpotifySearchQuery = z.infer<typeof spotifySearchQuerySchema>;

/**
 * Validates Spotify search query parameters.
 *
 * @param searchParams - The URL search parameters to validate.
 * @returns A NextResponse with an error if validation fails, or the validated query parameters if validation passes.
 */
export function validateSpotifySearchQuery(
  searchParams: URLSearchParams,
): NextResponse | SpotifySearchQuery {
  const params = Object.fromEntries(searchParams.entries());

  const validationResult = spotifySearchQuerySchema.safeParse(params);

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
