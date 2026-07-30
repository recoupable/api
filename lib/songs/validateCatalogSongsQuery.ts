import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { authorizeCatalogAccess } from "@/lib/songs/authorizeCatalogAccess";
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

export type ValidatedCatalogSongsQuery = CatalogSongsQuery & { accountId: string };

/**
 * Validates a catalog songs read: credentials, then query shape, then that the
 * catalog belongs to the caller.
 *
 * The order is the contract (chat#1912 row 6, recoupable/docs#282). Auth runs
 * before the query is parsed so a caller with no credentials gets 401 rather
 * than a validation 400 — a 400 without credentials is precisely what proved
 * this endpoint had no auth layer at all.
 *
 * @param request - The incoming request, carrying `x-api-key` or a bearer token
 * @returns A NextResponse (401/400/403), or the validated query plus the
 *   authenticated account
 */
export async function validateCatalogSongsQuery(
  request: NextRequest,
): Promise<NextResponse | ValidatedCatalogSongsQuery> {
  const auth = await validateAuthContext(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
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

  const forbidden = await authorizeCatalogAccess(auth.accountId, [
    validationResult.data.catalog_id,
  ]);
  if (forbidden) return forbidden;

  return { ...validationResult.data, accountId: auth.accountId };
}
