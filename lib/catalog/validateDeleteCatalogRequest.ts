import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

export const deleteCatalogSchema = z.object({
  catalogId: z
    .string({ message: "catalogId parameter is required" })
    .uuid("catalogId must be a valid UUID"),
});

export type ValidatedDeleteCatalogRequest = z.infer<typeof deleteCatalogSchema> & {
  accountId: string;
};

/**
 * Validates DELETE /api/catalogs/{catalogId} — auth (Privy bearer or x-api-key,
 * resolved to the caller's accountId) and the catalogId path segment (uuid).
 * There is no body: the catalog to delete is the one in the path.
 *
 * Visibility is checked by the handler, alongside the owner resolution — the
 * same split the rename and the catalog reads use.
 *
 * @param request - The incoming HTTP request.
 * @param catalogId - The catalogId path segment.
 * @returns The validated `{ accountId, catalogId }`, or a NextResponse to return directly.
 */
export async function validateDeleteCatalogRequest(
  request: NextRequest,
  catalogId: string,
): Promise<NextResponse | ValidatedDeleteCatalogRequest> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const result = deleteCatalogSchema.safeParse({ catalogId });

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
