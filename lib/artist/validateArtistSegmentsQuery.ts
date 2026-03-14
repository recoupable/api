import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const artistSegmentsQuerySchema = z.object({
  artist_account_id: z.string().min(1, "artist_account_id parameter is required"),
  page: z
    .string()
    .optional()
    .default("1")
    .transform(val => parseInt(val, 10))
    .pipe(z.number().int().positive()),
  limit: z
    .string()
    .optional()
    .default("20")
    .transform(val => parseInt(val, 10))
    .pipe(z.number().int().min(1).max(100)),
});

export type ArtistSegmentsQuery = z.infer<typeof artistSegmentsQuerySchema>;

/**
 * Validates artist segments query parameters.
 *
 * @param searchParams - The URL search parameters to validate.
 * @returns A NextResponse with an error if validation fails, or the validated query parameters if validation passes.
 */
export function validateArtistSegmentsQuery(
  searchParams: URLSearchParams,
): NextResponse | ArtistSegmentsQuery {
  const params = Object.fromEntries(searchParams.entries());

  const validationResult = artistSegmentsQuerySchema.safeParse(params);

  if (!validationResult.success) {
    const firstError = validationResult.error.issues[0];
    return NextResponse.json(
      {
        status: "error",
        missing_fields: firstError.path,
        error: firstError.message,
        segments: [],
        pagination: {
          total_count: 0,
          page: 1,
          limit: 20,
          total_pages: 0,
        },
      },
      {
        status: 400,
        headers: getCorsHeaders(),
      },
    );
  }

  return validationResult.data;
}
