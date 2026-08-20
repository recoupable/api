import { type NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { z } from "zod";

export const getCatalogMeasurementsQuerySchema = z.object({
  catalogId: z
    .string({ message: "catalogId parameter is required" })
    .uuid("catalogId must be a valid UUID"),
  account_id: z.string().uuid("account_id must be a valid UUID").optional(),
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
 * Validates GET /api/catalogs/{catalogId}/measurements — the catalogId path
 * segment (uuid), the optional query modifiers (account_id, artist_account_id,
 * page, limit), then auth (Privy bearer or x-api-key). Params parse first so
 * the optional account_id override can reach validateAuthContext, which owns
 * the authorization decision for acting on another account. The path id
 * always wins — a catalogId smuggled into the query string is ignored.
 *
 * @param request - The incoming HTTP request.
 * @param catalogId - The catalogId path segment.
 * @returns A NextResponse with an error if validation fails, or the validated request.
 */
export async function validateGetCatalogMeasurementsQuery(
  request: NextRequest,
  catalogId: string,
): Promise<NextResponse | GetCatalogMeasurementsQuery> {
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

  const authResult = await validateAuthContext(request, { accountId: result.data.account_id });
  if (authResult instanceof NextResponse) return authResult;

  return { ...result.data, accountId: authResult.accountId };
}
