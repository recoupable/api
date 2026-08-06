import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { successResponse } from "@/lib/networking/successResponse";
import { selectAccountCatalog } from "@/lib/supabase/account_catalogs/selectAccountCatalog";
import { updateCatalog } from "@/lib/supabase/catalogs/updateCatalog";
import { getCatalogOwnerIds } from "./getCatalogOwnerIds";
import { validateUpdateCatalogRequest } from "./validateUpdateCatalogRequest";

/**
 * PATCH /api/catalogs/{catalogId}
 *
 * Renames a catalog. `name` is the only mutable field — membership is managed
 * by the catalog-songs endpoints — and it exists because catalogs used to be
 * create-only: a valuation run that named its catalog generically could never
 * be corrected (chat#1942).
 *
 * The account is resolved from credentials (Privy bearer or x-api-key). A
 * catalog that doesn't exist, or belongs to neither the account nor one of its
 * organizations, is a 404 — the same visibility rule the catalog reads use, so
 * a catalog you cannot see is indistinguishable from one that isn't there
 * (chat#1938). Auth and input validation live in validateUpdateCatalogRequest.
 *
 * @param request - The request object
 * @param catalogIdParam - The catalogId path segment
 * @returns `{ status, catalog }` with the renamed catalog
 */
export async function updateCatalogHandler(
  request: NextRequest,
  catalogIdParam: string,
): Promise<NextResponse> {
  try {
    const validated = await validateUpdateCatalogRequest(request, catalogIdParam);
    if (validated instanceof NextResponse) {
      return validated;
    }
    const { accountId, catalogId, name } = validated;

    const ownerIds = await getCatalogOwnerIds(accountId);
    const link = await selectAccountCatalog({ accountIds: ownerIds, catalogId });
    if (!link) {
      return errorResponse("Catalog not found", 404);
    }

    const catalog = await updateCatalog(catalogId, { name });
    if (!catalog) {
      return errorResponse("Catalog not found", 404);
    }

    return successResponse({ catalog });
  } catch (error) {
    console.error("Error updating catalog:", error);
    return errorResponse("Internal server error", 500);
  }
}
