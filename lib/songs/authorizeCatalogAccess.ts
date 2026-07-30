import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { selectAccountCatalog } from "@/lib/supabase/account_catalogs/selectAccountCatalog";

/**
 * Gate for every `/api/catalogs/songs` operation: the caller must be
 * authenticated and the catalog must belong to them.
 *
 * All three operations previously enforced nothing, so anyone holding a
 * catalog id could read, add or remove its songs while the sibling
 * `/measurements` endpoint returned 401 for the same catalog (chat#1912 row 6,
 * contract in recoupable/docs#282).
 *
 * The account is always the authenticated one, never a caller-supplied value.
 *
 * A write can name several catalogs in one body, so every distinct catalog is
 * checked — authorizing only the first would let one owned catalog carry edits
 * to catalogs the caller does not own.
 *
 * @param request - The incoming request, carrying `x-api-key` or a bearer token
 * @param catalogIds - Every catalog the operation touches
 * @returns `{ accountId }` when authorized, or a 401/403 NextResponse
 */
export async function authorizeCatalogAccess(
  request: NextRequest,
  catalogIds: string[],
): Promise<{ accountId: string } | NextResponse> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const { accountId } = authResult;
  const links = await Promise.all(
    [...new Set(catalogIds)].map(catalogId => selectAccountCatalog({ accountId, catalogId })),
  );
  if (links.some(link => !link)) {
    return NextResponse.json(
      {
        status: "error",
        error: "This catalog does not belong to the authenticated account",
      },
      { status: 403, headers: getCorsHeaders() },
    );
  }

  return { accountId };
}
