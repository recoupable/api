import { type NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { z } from "zod";

export const getCatalogValuationsQuerySchema = z.object({
  catalogId: z
    .string({ message: "catalogId parameter is required" })
    .uuid("catalogId must be a valid UUID"),
  limit: z
    .string()
    .optional()
    .default("30")
    .transform(val => Number(val))
    .pipe(
      z
        .number()
        .int("limit must be an integer")
        .min(1, "limit must be at least 1")
        .max(100, "limit must be at most 100"),
    ),
});

export type GetCatalogValuationsQuery = z.infer<typeof getCatalogValuationsQuerySchema> & {
  accountId: string;
};

/**
 * Validates GET /api/catalogs/{catalogId}/valuations — auth (Privy bearer or
 * x-api-key, resolved to the caller's accountId), the catalogId path segment
 * (uuid), and the optional limit (1–100, default 30; limit=1 is the current
 * value). Auth runs first, per the validator convention of the catalogs
 * family. The path id always wins over anything in the query string.
 *
 * @param request - The incoming HTTP request.
 * @param catalogId - The catalogId path segment.
 * @returns A NextResponse with an error if validation fails, or the validated request.
 */
export async function validateGetCatalogValuationsQuery(
  request: NextRequest,
  catalogId: string,
): Promise<NextResponse | GetCatalogValuationsQuery> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(request.url);
  const result = getCatalogValuationsQuerySchema.safeParse({
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
