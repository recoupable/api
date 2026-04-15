import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const getSegmentsQuerySchema = z.object({
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

export type ValidatedGetSegmentsQuery = z.infer<typeof getSegmentsQuerySchema>;

/**
 * Validates query parameters for GET /api/artists/{id}/segments.
 *
 * The artist account ID is taken from the route path, so it is not part of the
 * query schema. Only `page` and `limit` are accepted.
 *
 * @param searchParams - The URL search parameters to validate.
 * @returns A NextResponse with an error if validation fails, or the validated query parameters if validation passes.
 */
export function validateGetSegmentsQuery(
  searchParams: URLSearchParams,
): NextResponse | ValidatedGetSegmentsQuery {
  const params = Object.fromEntries(searchParams.entries());

  const validationResult = getSegmentsQuerySchema.safeParse(params);

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
