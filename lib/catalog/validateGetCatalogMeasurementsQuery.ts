import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const getCatalogMeasurementsQuerySchema = z.object({
  catalogId: z
    .string({ message: "catalogId parameter is required" })
    .uuid("catalogId must be a valid UUID"),
  artist_account_id: z.string().uuid("artist_account_id must be a valid UUID").optional(),
  page: z
    .string()
    .optional()
    .default("1")
    .transform(val => Number(val))
    .pipe(z.number().int("page must be a positive integer").positive("page must be positive")),
  limit: z
    .string()
    .optional()
    .default("50")
    .transform(val => Number(val))
    .pipe(
      z
        .number()
        .int("limit must be an integer")
        .min(1, "limit must be at least 1")
        .max(100, "limit must be at most 100"),
    ),
});

export type GetCatalogMeasurementsQuery = z.infer<typeof getCatalogMeasurementsQuerySchema>;

/**
 * Validates GET /api/catalogs/{catalogId}/measurements: the catalogId path
 * segment (uuid) plus the optional query modifiers (artist_account_id,
 * page, limit). The path id always wins — a catalogId smuggled into the
 * query string is ignored.
 *
 * @param searchParams - The URL search parameters to validate.
 * @param catalogId - The catalogId path segment.
 * @returns A NextResponse with an error if validation fails, or the validated request.
 */
export function validateGetCatalogMeasurementsQuery(
  searchParams: URLSearchParams,
  catalogId: string,
): NextResponse | GetCatalogMeasurementsQuery {
  const result = getCatalogMeasurementsQuerySchema.safeParse({
    ...Object.fromEntries(searchParams.entries()),
    catalogId,
  });

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
