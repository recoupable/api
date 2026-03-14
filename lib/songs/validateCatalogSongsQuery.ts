import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const catalogSongsQuerySchema = z.object({
  catalog_id: z.string().min(1, "catalog_id parameter is required"),
  artistName: z.string().optional(),
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

export type CatalogSongsQuery = z.infer<typeof catalogSongsQuerySchema>;

/**
 * Validates catalog songs query parameters.
 *
 * @param searchParams - The URL search parameters to validate.
 * @returns A NextResponse with an error if validation fails, or the validated query parameters if validation passes.
 */
export function validateCatalogSongsQuery(
  searchParams: URLSearchParams,
): NextResponse | CatalogSongsQuery {
  const params = Object.fromEntries(searchParams.entries());

  const validationResult = catalogSongsQuerySchema.safeParse(params);

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
