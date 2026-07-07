import { type NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
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

export type GetCatalogMeasurementsQuery = z.infer<typeof getCatalogMeasurementsQuerySchema> & {
  accountId: string;
};

/**
 * Validates GET /api/catalogs/{catalogId}/measurements — auth (Privy bearer
 * or x-api-key, resolved to the caller's accountId), the catalogId path
 * segment (uuid), and the optional query modifiers (artist_account_id, page,
 * limit). Auth runs first, per the validator convention of the measurements
 * family. The path id always wins — a catalogId smuggled into the query
 * string is ignored.
 *
 * @param request - The incoming HTTP request.
 * @param catalogId - The catalogId path segment.
 * @returns A NextResponse with an error if validation fails, or the validated request.
 */
export async function validateGetCatalogMeasurementsQuery(
  request: NextRequest,
  catalogId: string,
): Promise<NextResponse | GetCatalogMeasurementsQuery> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(request.url);
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

  return { ...result.data, accountId: authResult.accountId };
}
