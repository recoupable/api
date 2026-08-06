import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { successResponse } from "@/lib/networking/successResponse";
import { selectAccountCatalog } from "@/lib/supabase/account_catalogs/selectAccountCatalog";
import { selectPlaycountSnapshotIdsByCatalog } from "@/lib/supabase/playcount_snapshots/selectPlaycountSnapshotIdsByCatalog";
import { deleteCatalogById } from "@/lib/supabase/catalogs/deleteCatalogById";
import { getCatalogOwnerIds } from "./getCatalogOwnerIds";
import { validateDeleteCatalogRequest } from "./validateDeleteCatalogRequest";

/**
 * DELETE /api/catalogs/{catalogId}
 *
 * Removes a catalog — for genuine duplicates; a badly named catalog should be
 * renamed with PATCH instead (chat#1942).
 *
 * What goes with it is the schema's decision, not this handler's:
 * `catalog_songs`, `account_catalogs` and `catalog_valuations` cascade, while
 * `playcount_snapshots.catalog` is `ON DELETE SET NULL`. That asymmetry is the
 * point — a catalog is a label over songs and can be rebuilt from its snapshot
 * in one call, whereas the snapshot is a metered capture that spent the
 * customer's credits and cannot be re-taken for a past date. So the ids of the
 * snapshots this delete releases are read *before* the delete clears them and
 * returned to the caller: passing one back to POST /api/catalogs with a `name`
 * re-materializes the run as a correctly named catalog.
 *
 * The account is resolved from credentials. A catalog that doesn't exist, or
 * belongs to neither the account nor one of its organizations, is a 404 — the
 * same visibility rule the catalog reads use (chat#1938). Fails closed: a
 * failed snapshot lookup is a 500 and nothing is deleted, because deleting
 * without knowing what was released would strand the paid-for measurement.
 *
 * @param request - The request object
 * @param catalogIdParam - The catalogId path segment
 * @returns `{ status, catalog_id, released_snapshot_ids }`
 */
export async function deleteCatalogHandler(
  request: NextRequest,
  catalogIdParam: string,
): Promise<NextResponse> {
  try {
    const validated = await validateDeleteCatalogRequest(request, catalogIdParam);
    if (validated instanceof NextResponse) {
      return validated;
    }
    const { accountId, catalogId } = validated;

    const ownerIds = await getCatalogOwnerIds(accountId);
    const link = await selectAccountCatalog({ accountIds: ownerIds, catalogId });
    if (!link) {
      return errorResponse("Catalog not found", 404);
    }

    const releasedSnapshotIds = await selectPlaycountSnapshotIdsByCatalog(catalogId);
    if (releasedSnapshotIds === null) {
      return errorResponse("Internal server error", 500);
    }

    const deletedId = await deleteCatalogById(catalogId);
    if (!deletedId) {
      return errorResponse("Catalog not found", 404);
    }

    return successResponse({
      catalog_id: deletedId,
      released_snapshot_ids: releasedSnapshotIds,
    });
  } catch (error) {
    console.error("Error deleting catalog:", error);
    return errorResponse("Internal server error", 500);
  }
}
