import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { successResponse } from "@/lib/networking/successResponse";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validateCreateCatalogBody } from "./validateCreateCatalogBody";
import { createSnapshotCatalog } from "./createSnapshotCatalog";
import { selectPlaycountSnapshots } from "@/lib/supabase/playcount_snapshots/selectPlaycountSnapshots";
import { selectCatalogById } from "@/lib/supabase/catalogs/selectCatalogById";
import { insertCatalog } from "@/lib/supabase/catalogs/insertCatalog";
import { insertAccountCatalog } from "@/lib/supabase/account_catalogs/insertAccountCatalog";

const DEFAULT_CATALOG_NAME = "Valuation Catalog";

/**
 * POST /api/catalogs
 *
 * Creates a catalog owned by the authenticated account. The owning account is
 * resolved from credentials (Privy bearer or x-api-key), never from the body.
 *
 * With `snapshot`, materializes the catalog from a completed valuation snapshot:
 * the snapshot must be owned by the caller, and re-claiming the same snapshot is
 * idempotent (returns the catalog already created for that run).
 *
 * @param request - The request object
 * @returns A NextResponse with `{ status, catalog, songs_added }`
 */
export async function createCatalogHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json().catch(() => null);

    const validated = validateCreateCatalogBody(body);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const authResult = await validateAuthContext(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { accountId } = authResult;

    if (!validated.snapshot) {
      const catalog = await insertCatalog(validated.name ?? DEFAULT_CATALOG_NAME);
      await insertAccountCatalog({ account: accountId, catalog: catalog.id });
      return successResponse({ catalog, songs_added: 0 });
    }

    const [snapshot] = await selectPlaycountSnapshots({ id: validated.snapshot });
    if (!snapshot) {
      return errorResponse("Snapshot not found", 404);
    }
    if (snapshot.account !== accountId) {
      return errorResponse("Snapshot belongs to a different account", 403);
    }

    // Idempotent re-claim: the run already produced a catalog.
    if (snapshot.catalog) {
      const existing = await selectCatalogById(snapshot.catalog);
      if (existing) {
        return successResponse({ catalog: existing, songs_added: 0 });
      }
    }

    const { catalog, songsAdded } = await createSnapshotCatalog({
      accountId,
      snapshot,
      name: validated.name,
    });
    return successResponse({ catalog, songs_added: songsAdded });
  } catch (error) {
    console.error("Error creating catalog:", error);
    return errorResponse("Internal server error", 500);
  }
}
