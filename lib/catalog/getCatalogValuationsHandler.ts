import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { successResponse } from "@/lib/networking/successResponse";
import { validateGetCatalogValuationsQuery } from "./validateGetCatalogValuationsQuery";
import { selectAccountCatalog } from "@/lib/supabase/account_catalogs/selectAccountCatalog";
import { selectCatalogValuations } from "@/lib/supabase/catalog_valuations/selectCatalogValuations";

/**
 * GET /api/catalogs/{catalogId}/valuations?limit=
 *
 * The catalog's persisted valuation history, latest-first — the rows written
 * by valuation runs and daily read-time snapshots (chat#1889 row 15).
 * limit=1 returns just the current value; the default 30 gives a series for
 * trend rendering. Auth and input validation live in
 * validateGetCatalogValuationsQuery (SRP). The account is resolved from
 * credentials (Privy bearer or x-api-key); a catalog that doesn't exist or
 * belongs to another account is a 404.
 *
 * @param request - The request object
 * @param catalogIdParam - The catalogId path segment
 * @returns `{ status, valuations }` with rows `{ low, mid, high, measured_song_count, total_streams, measured_at }`
 */
export async function getCatalogValuationsHandler(
  request: NextRequest,
  catalogIdParam: string,
): Promise<NextResponse> {
  try {
    const validated = await validateGetCatalogValuationsQuery(request, catalogIdParam);
    if (validated instanceof NextResponse) {
      return validated;
    }
    const { accountId, catalogId, limit } = validated;

    const link = await selectAccountCatalog({ accountId, catalogId });
    if (!link) {
      return errorResponse("Catalog not found", 404);
    }

    const rows = await selectCatalogValuations({ catalogId, limit });
    if (!rows) {
      return errorResponse("Internal server error", 500);
    }

    return successResponse({
      valuations: rows.map(row => ({
        low: Number(row.low),
        mid: Number(row.mid),
        high: Number(row.high),
        measured_song_count: row.measured_song_count,
        total_streams: row.total_streams,
        measured_at: row.measured_at,
      })),
    });
  } catch (error) {
    console.error("Error fetching catalog valuations:", error);
    return errorResponse("Internal server error", 500);
  }
}
