import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { selectAccountCatalogs } from "@/lib/supabase/account_catalogs/selectAccountCatalogs";

/**
 * Ownership half of the `/api/catalogs/songs` gate: every catalog the operation
 * touches must belong to `accountId`.
 *
 * Authentication is deliberately **not** done here. Callers run
 * `validateAuthContext` before parsing or validating the request, so a caller
 * with no credentials gets 401 rather than a body-validation 400 — the exact
 * confusion that hid this hole in the first place (chat#1912 row 6).
 *
 * Reads the caller's catalogs in **one** query and checks membership in memory,
 * so a bulk body naming many catalogs cannot fan out into many simultaneous
 * queries. `selectAccountCatalogs` throws on a query failure, so a database
 * outage surfaces as a 500 rather than a false "does not belong" 403.
 *
 * @param accountId - The authenticated account
 * @param catalogIds - Every catalog the operation touches
 * @returns A 403 NextResponse when any catalog is not the caller's, else null
 */
export async function authorizeCatalogAccess(
  accountId: string,
  catalogIds: string[],
): Promise<NextResponse | null> {
  const owned = await selectAccountCatalogs(accountId);
  const ownedIds = new Set(owned.map(catalog => catalog.id));

  if (catalogIds.every(id => ownedIds.has(id))) return null;

  return NextResponse.json(
    {
      status: "error",
      error: "This catalog does not belong to the authenticated account",
    },
    { status: 403, headers: getCorsHeaders() },
  );
}
