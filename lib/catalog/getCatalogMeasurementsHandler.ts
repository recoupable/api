import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { successResponse } from "@/lib/networking/successResponse";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validateGetCatalogMeasurementsQuery } from "./validateGetCatalogMeasurementsQuery";
import { computeValuationBand } from "./computeValuationBand";
import { getCatalogEarliestReleaseDate } from "./getCatalogEarliestReleaseDate";
import { selectAccountCatalog } from "@/lib/supabase/account_catalogs/selectAccountCatalog";
import { selectCatalogMeasurementsAggregate } from "@/lib/supabase/song_measurements/selectCatalogMeasurementsAggregate";
import { selectCatalogMeasurementsPage } from "@/lib/supabase/song_measurements/selectCatalogMeasurementsPage";

/**
 * GET /api/catalogs/measurements?catalogId=&artist_account_id=&page=&limit=
 *
 * One page of the latest Spotify play counts per song (ISRC) in a catalog
 * plus whole-scope aggregates: measured_song_count, total_streams and a
 * valuation band derived at read time with the same model as the marketing
 * valuation card. The aggregates are computed in a single SQL aggregate over
 * the entire scope — no row cap — regardless of the requested page.
 * Optionally scoped to one artist's songs (catalog_songs ∩ song_artists) via
 * artist_account_id; the applied filter is echoed back so clients can verify
 * the response scope. The account is resolved from credentials (Privy bearer
 * or x-api-key); a catalog that doesn't exist or belongs to another account
 * is a 404.
 *
 * @param request - The request object
 * @returns `{ status, measurements, pagination, measured_song_count, total_streams, valuation, artist_account_id, catalog_age_years }`
 */
export async function getCatalogMeasurementsHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const validated = validateGetCatalogMeasurementsQuery(searchParams);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const authResult = await validateAuthContext(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { accountId } = authResult;
    const { catalogId, artist_account_id: artistAccountId, page, limit } = validated;

    const link = await selectAccountCatalog({ accountId, catalogId });
    if (!link) {
      return errorResponse("Catalog not found", 404);
    }

    const [aggregate, measurements, earliestReleaseDate] = await Promise.all([
      selectCatalogMeasurementsAggregate({ catalogId, artistAccountId }),
      selectCatalogMeasurementsPage({ catalogId, artistAccountId, page, limit }),
      getCatalogEarliestReleaseDate(catalogId),
    ]);
    if (!aggregate || !measurements) {
      return errorResponse("Internal server error", 500);
    }

    const { valuation, catalogAgeYears } = computeValuationBand({
      totalStreams: aggregate.totalStreams,
      earliestReleaseDate,
    });

    return successResponse({
      measurements,
      pagination: {
        total_count: aggregate.measuredSongCount,
        page,
        limit,
        total_pages: Math.ceil(aggregate.measuredSongCount / limit),
      },
      measured_song_count: aggregate.measuredSongCount,
      total_streams: aggregate.totalStreams,
      valuation,
      artist_account_id: artistAccountId ?? null,
      catalog_age_years: catalogAgeYears,
    });
  } catch (error) {
    console.error("Error fetching catalog measurements:", error);
    return errorResponse("Internal server error", 500);
  }
}
