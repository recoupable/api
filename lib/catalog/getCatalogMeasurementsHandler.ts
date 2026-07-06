import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { successResponse } from "@/lib/networking/successResponse";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validateGetCatalogMeasurementsQuery } from "./validateGetCatalogMeasurementsQuery";
import { latestMeasurementsPerIsrc } from "./latestMeasurementsPerIsrc";
import { computeValuationBand } from "./computeValuationBand";
import { getCatalogEarliestReleaseDate } from "./getCatalogEarliestReleaseDate";
import { selectAccountCatalog } from "@/lib/supabase/account_catalogs/selectAccountCatalog";
import { selectCatalogSongTitles } from "@/lib/supabase/catalog_songs/selectCatalogSongTitles";
import { selectSongMeasurements } from "@/lib/supabase/song_measurements/selectSongMeasurements";

/**
 * GET /api/catalogs/measurements?catalogId=
 *
 * Latest Spotify play count per song (ISRC) in a catalog plus a valuation
 * band derived at read time with the same model as the marketing valuation
 * card. The account is resolved from credentials (Privy bearer or x-api-key);
 * a catalog that doesn't exist or belongs to another account is a 404.
 *
 * @param request - The request object
 * @returns `{ status, measurements, valuation, total_streams, catalog_age_years }`
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
    const { catalogId } = validated;

    const link = await selectAccountCatalog({ accountId, catalogId });
    if (!link) {
      return errorResponse("Catalog not found", 404);
    }

    const songs = await selectCatalogSongTitles(catalogId);
    const titles = new Map(songs.map(s => [s.isrc, s.title]));
    const [rows, earliestReleaseDate] = await Promise.all([
      songs.length > 0
        ? selectSongMeasurements({
            songs: songs.map(s => s.isrc),
            platform: "spotify",
            metric: "platform_displayed_play_count",
          })
        : Promise.resolve([]),
      getCatalogEarliestReleaseDate(catalogId),
    ]);

    const { measurements, totalStreams } = latestMeasurementsPerIsrc(rows, titles);
    const { valuation, catalogAgeYears } = computeValuationBand({
      totalStreams,
      earliestReleaseDate,
    });

    return successResponse({
      measurements,
      valuation,
      total_streams: totalStreams,
      catalog_age_years: catalogAgeYears,
    });
  } catch (error) {
    console.error("Error fetching catalog measurements:", error);
    return errorResponse("Internal server error", 500);
  }
}
