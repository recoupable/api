import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateGetCatalogsRequest } from "@/lib/catalog/validateGetCatalogsRequest";
import { selectAccountCatalogs } from "@/lib/supabase/account_catalogs/selectAccountCatalogs";
import { getCatalogOwnerIds } from "./getCatalogOwnerIds";
import { getCatalogValuations } from "./getCatalogValuations";
import { resolveCatalogOwners } from "./resolveCatalogOwners";

/**
 * Handler for GET /api/accounts/{id}/catalogs.
 *
 * Lists catalogs linked to the account via `account_catalogs`, ordered by
 * `created_at desc`, each with its estimated value band and its owner
 * (chat#1943) — enough for a list to be ranked by worth and for a member to
 * tell an organization's catalog from their own, without a request per card.
 *
 * The band uses the same `computeValuationBand` model as
 * `GET /api/catalogs/{id}/measurements`, so a card and the report it opens
 * cannot disagree; it is null for a catalog with no measured songs rather than
 * a misleading $0. The owner is the organization when a catalog is owned both
 * directly and through one (chat#1938).
 *
 * @param request - The incoming request
 * @param params - Route params containing the account ID
 * @returns 200 with `{ status, catalogs }`, or 400/401/403/404/500 on error
 */
export async function getCatalogsHandler(
  request: NextRequest,
  params: Promise<{ id: string }>,
): Promise<NextResponse> {
  try {
    const { id } = await params;

    const validated = await validateGetCatalogsRequest(request, id);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const ownerIds = await getCatalogOwnerIds(validated.accountId);
    const catalogs = await selectAccountCatalogs(ownerIds);
    const catalogIds = catalogs.map(catalog => catalog.id);

    // getCatalogOwnerIds puts the account first, so the rest are its organizations.
    const organizationIds = ownerIds.filter(ownerId => ownerId !== validated.accountId);
    const [valuations, owners] = await Promise.all([
      getCatalogValuations(catalogIds),
      resolveCatalogOwners({ catalogIds, organizationIds }),
    ]);

    return NextResponse.json(
      {
        status: "success",
        catalogs: catalogs.map(catalog => ({
          ...catalog,
          measured_song_count: valuations.get(catalog.id)?.measuredSongCount ?? 0,
          valuation: valuations.get(catalog.id)?.valuation ?? null,
          owner: owners.get(catalog.id) ?? null,
        })),
      },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("[ERROR] getCatalogsHandler:", error);
    return NextResponse.json(
      {
        status: "error",
        error: "Internal server error",
      },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
