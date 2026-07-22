import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { successResponse } from "@/lib/networking/successResponse";
import generateAccessToken from "@/lib/spotify/generateAccessToken";
import getArtistAlbums from "@/lib/spotify/getArtistAlbums";
import { createMeasurementJob } from "@/lib/research/measurement_jobs/createMeasurementJob";
import { selectPlaycountSnapshots } from "@/lib/supabase/playcount_snapshots/selectPlaycountSnapshots";
import { createSnapshotCatalog } from "@/lib/catalog/createSnapshotCatalog";
import { selectCatalogMeasurementsAggregate } from "@/lib/supabase/song_measurements/selectCatalogMeasurementsAggregate";
import { getCatalogEarliestReleaseDate } from "@/lib/catalog/getCatalogEarliestReleaseDate";
import { computeValuationBand } from "@/lib/catalog/computeValuationBand";
import { validateRunValuationRequest } from "./validateRunValuationRequest";
import { extractValuationAlbums } from "./extractValuationAlbums";
import { waitForSnapshotMeasurements } from "./waitForSnapshotMeasurements";
import { linkSearchedArtistToAccount } from "./linkSearchedArtistToAccount";

interface SpotifyAlbumsResponse {
  items?: { id: string; release_date?: string | null }[];
}

/**
 * POST /api/valuation
 *
 * One bearer-authed call that turns a Spotify artist into an account-owned
 * catalog with an estimated value band. Composes existing internals:
 *   1. resolve the artist's releases (Spotify),
 *   2. capture current play counts under the caller's account (spends credits),
 *   3. wait (bounded) for the capture to land,
 *   4. materialize the catalog from the snapshot (reuses createSnapshotCatalog,
 *      which also attaches the canonical artist to the roster),
 *   5. value it with the same model as GET /catalogs/{id}/measurements.
 *
 * The owning account is resolved from credentials, never the body. This is the
 * shared server-side version of marketing/lib/valuation/runValuationFlow so
 * marketing and chat call one endpoint instead of orchestrating client-side.
 *
 * @returns `{ status, catalog, band, songs_measured }`
 */
export async function runValuationHandler(request: NextRequest): Promise<NextResponse> {
  try {
    // Auth + body validation in one place (SRP) — resolves the owning account
    // from credentials and requires a spotify_artist_id.
    const validated = await validateRunValuationRequest(request);
    if (validated instanceof NextResponse) return validated;
    const { accountId, spotify_artist_id } = validated;

    // 1. Resolve the artist's releases. The caller's auth already came from the
    //    request header above (validateAuthContext -> accountId). This is a
    //    separate Spotify app token (client credentials) needed to read
    //    Spotify's public Web API — not the caller's credential.
    const spotifyToken = await generateAccessToken();
    if (!spotifyToken || spotifyToken.error || !spotifyToken.access_token) {
      return errorResponse("Spotify authentication failed", 502);
    }
    const albumsResult = await getArtistAlbums({
      id: spotify_artist_id,
      include_groups: "album,single",
      limit: 50,
      accessToken: spotifyToken.access_token,
    });
    if (albumsResult.error || !albumsResult.data) {
      return errorResponse("Couldn't resolve the artist's releases", 502);
    }
    const { albumIds } = extractValuationAlbums(
      (albumsResult.data as SpotifyAlbumsResponse).items ?? [],
    );
    if (albumIds.length === 0) {
      return errorResponse("No releases found for this Spotify artist", 404);
    }

    // 2. Capture current play counts under the caller's account (spends credits).
    const job = await createMeasurementJob({
      accountId,
      body: {
        source: "current",
        scope: { album_ids: albumIds },
        platforms: ["spotify"],
      },
    });
    if ("error" in job) return errorResponse(job.error, job.status);
    const snapshotId = (job.data as { id: string }).id;

    // 3. Wait (bounded) for the capture to land.
    const measured = await waitForSnapshotMeasurements(snapshotId);
    if (!measured) {
      return errorResponse("The measurement didn't complete in time; retry shortly", 504);
    }

    // 4. Materialize the catalog from the snapshot (owned by this account,
    //    freshly created, not yet claimed — so createSnapshotCatalog is safe).
    const [snapshot] = await selectPlaycountSnapshots({ id: snapshotId });
    if (!snapshot) return errorResponse("Snapshot not found", 404);
    const { catalog, songsAdded, attachedArtistId } = await createSnapshotCatalog({
      accountId,
      snapshot,
    });

    // Guarantee a populated roster: the canonical (ISRC → song_artists) attach
    // is empty for funnel signups whose songs aren't yet ingested, which left
    // them on an empty /artists (chat#1881 P0). When it resolves nothing, link
    // the searched Spotify artist directly so they can confirm their roster.
    if (!attachedArtistId) {
      await linkSearchedArtistToAccount({
        accountId,
        spotifyArtistId: spotify_artist_id,
        accessToken: spotifyToken.access_token,
      });
    }

    // 5. Value it — same model as GET /catalogs/{id}/measurements.
    const [aggregate, earliestReleaseDate] = await Promise.all([
      selectCatalogMeasurementsAggregate({ catalogId: catalog.id }),
      getCatalogEarliestReleaseDate(catalog.id),
    ]);
    const { valuation } = computeValuationBand({
      totalStreams: aggregate?.totalStreams ?? 0,
      earliestReleaseDate,
    });

    return successResponse({
      catalog,
      band: valuation,
      songs_measured: songsAdded,
    });
  } catch (error) {
    console.error("Error running valuation:", error);
    return errorResponse("Internal server error", 500);
  }
}
