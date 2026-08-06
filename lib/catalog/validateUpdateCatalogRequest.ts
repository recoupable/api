import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { safeParseJson } from "@/lib/networking/safeParseJson";

export const updateCatalogSchema = z.object({
  catalogId: z
    .string({ message: "catalogId parameter is required" })
    .uuid("catalogId must be a valid UUID"),
  name: z
    .string({ message: "name is required" })
    .transform(value => value.trim())
    .pipe(z.string().min(1, "name must not be empty")),
});

export type ValidatedUpdateCatalogRequest = z.infer<typeof updateCatalogSchema> & {
  accountId: string;
};

/**
 * Validates PATCH /api/catalogs/{catalogId} — auth (Privy bearer or x-api-key,
 * resolved to the caller's accountId), the catalogId path segment (uuid), and
 * the `{ name }` body. Auth runs first, per the validator convention of the
 * catalog family: the 401 precedes any body handling.
 *
 * The name is trimmed, and a whitespace-only name is rejected rather than
 * stored — a catalog named " " is as unidentifiable as the generic default
 * this endpoint exists to replace (chat#1942).
 *
 * Visibility is deliberately NOT checked here: it belongs with the owner
 * resolution in the handler, the same split getCatalogMeasurementsHandler uses.
 *
 * @param request - The incoming HTTP request.
 * @param catalogId - The catalogId path segment.
 * @returns The validated `{ accountId, catalogId, name }`, or a NextResponse to return directly.
 */
export async function validateUpdateCatalogRequest(
  request: NextRequest,
  catalogId: string,
): Promise<NextResponse | ValidatedUpdateCatalogRequest> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const body = await safeParseJson(request);
  const result = updateCatalogSchema.safeParse({
    ...(typeof body === "object" && body !== null ? body : {}),
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
