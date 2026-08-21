import { NextRequest, NextResponse, after } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { successResponse } from "@/lib/networking/successResponse";
import generateAccessToken from "@/lib/spotify/generateAccessToken";
import getArtist from "@/lib/spotify/getArtist";
import getArtistAlbums from "@/lib/spotify/getArtistAlbums";
import { createMeasurementJob } from "@/lib/research/measurement_jobs/createMeasurementJob";
import { selectPlaycountSnapshots } from "@/lib/supabase/playcount_snapshots/selectPlaycountSnapshots";
import { resolveClaimedCatalog } from "@/lib/catalog/resolveClaimedCatalog";
import { selectCatalogMeasurementsAggregate } from "@/lib/supabase/song_measurements/selectCatalogMeasurementsAggregate";
import { getCatalogEarliestReleaseDate } from "@/lib/catalog/getCatalogEarliestReleaseDate";
import { computeValuationBand } from "@/lib/catalog/computeValuationBand";
import { sendValuationReportEmail } from "@/lib/emails/valuationReport/sendValuationReportEmail";
import { captureValuationLead } from "@/lib/valuation/captureValuationLead";
import {
  toValuationEmailOutcome,
  type ValuationEmailOutcome,
} from "@/lib/valuation/toValuationEmailOutcome";
import { attachCanonicalArtistToAccount } from "@/lib/catalog/attachCanonicalArtistToAccount";
import { resolveOrCreateArtist } from "@/lib/artists/resolveOrCreateArtist";
import { validateRunValuationRequest } from "./validateRunValuationRequest";
import { extractValuationAlbums } from "./extractValuationAlbums";
import { waitForSnapshotMeasurements } from "./waitForSnapshotMeasurements";
import { enrichSearchedArtistProfile } from "./enrichSearchedArtistProfile";

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
 *   4. materialize the catalog from the snapshot (resolveClaimedCatalog —
 *      idempotent when the snapshot is already claimed),
 *   5. value it with the same model as GET /catalogs/{id}/measurements.
 *
 * The owning account comes from credentials; an authorized caller may act for
 * a member account via the validated `account_id` override (every side effect
 * scopes to that effective account). This is the shared server-side version of
 * marketing/lib/valuation/runValuationFlow so marketing and chat call one
 * endpoint instead of orchestrating client-side.
 *
 * @returns `{ status, catalog, band, songs_measured }`
 */
export async function runValuationHandler(request: NextRequest): Promise<NextResponse> {
  try {
    // Auth + body validation in one place (SRP) — resolves the owning account
    // from credentials and requires a spotify_artist_id.
    const validated = await validateRunValuationRequest(request);
    if (validated instanceof NextResponse) return validated;
    const { accountId, spotify_artist_id, organizationId } = validated;

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

    // Resolve the searched Spotify profile once (name + avatar + followers).
    // Deliberately ahead of the catalog creation below: the artist's name is
    // what the catalog is named after, and without it every valuation produced
    // a catalog called "Valuation Catalog" (chat#1942).
    const { artist: searchedArtist } = await getArtist(
      spotify_artist_id,
      spotifyToken.access_token,
    );

    // 4. Materialize the catalog from the snapshot. createMeasurementJob can
    //    hand back an already-claimed capture (60-minute reuse, chat#1912 row
    //    4), so the claim goes through resolveClaimedCatalog: a re-run reuses
    //    the existing catalog instead of minting a duplicate and repointing
    //    the snapshot (chat#1967). The catalog goes to the organization when
    //    one was named (chat#1938). Named after the measured artist so a
    //    roster of valuations is legible at a glance; when Spotify resolves
    //    nothing, the DEFAULT_CATALOG_NAME still applies (chat#1942).
    const [snapshot] = await selectPlaycountSnapshots({ id: snapshotId });
    if (!snapshot) return errorResponse("Snapshot not found", 404);
    const { catalog, isrcs } = await resolveClaimedCatalog({
      accountId,
      ownerId: organizationId ?? accountId,
      snapshot,
      name: searchedArtist?.name?.trim() || undefined,
    });

    // Populate the roster — one sequence, one catch site (chat#1965). The
    // canonical (ISRC → song_artists) attach targets the calling account (the
    // artist belongs on the roster of whoever ran the claim, chat#1938); when
    // the graph resolves nothing (funnel signups whose songs aren't ingested,
    // chat#1881 P0), the shared resolver links or creates the searched Spotify
    // artist instead. The rostered artist is then enriched with the searched
    // avatar + follower count so it doesn't render blank (chat#1881 P1).
    // A failed attach must not fail the valuation — the customer paid credits
    // and is owed their number — but it must never be silent either: the error
    // is carried into the lead alert below.
    let rosterArtistId: string | null = null;
    let rosterAttachError: string | undefined;
    try {
      rosterArtistId = await attachCanonicalArtistToAccount({ accountId, isrcs });
      if (!rosterArtistId && searchedArtist?.name) {
        const { artist } = await resolveOrCreateArtist({
          name: searchedArtist.name,
          accountId,
          spotifyArtistId: spotify_artist_id,
        });
        rosterArtistId = artist?.account_id ?? null;
      }
      if (rosterArtistId && searchedArtist) {
        await enrichSearchedArtistProfile({
          artistId: rosterArtistId,
          spotifyArtistId: spotify_artist_id,
          spotifyArtist: searchedArtist,
        });
      }
    } catch (error) {
      console.error("Roster attach failed for valuation:", error);
      rosterAttachError = error instanceof Error ? error.message : String(error);
    }

    // 5. Value it — same model as GET /catalogs/{id}/measurements.
    const [aggregate, earliestReleaseDate] = await Promise.all([
      selectCatalogMeasurementsAggregate({ catalogId: catalog.id }),
      getCatalogEarliestReleaseDate(catalog.id),
    ]);
    const { valuation, catalogAgeYears, ageFlooredToOneYear } = computeValuationBand({
      totalStreams: aggregate?.totalStreams ?? 0,
      earliestReleaseDate,
    });

    // Deferred so it never blocks the response (chat#1881); one block, in
    // order: the email consumes the numbers computed above and only fires when
    // there are streams to show (chat#1969), then the lead capture (chat#1885)
    // reports the email's actual fate next to the roster outcome.
    after(async () => {
      const emailOutcome: ValuationEmailOutcome =
        aggregate && aggregate.totalStreams > 0
          ? await sendValuationReportEmail({
              snapshot,
              catalogId: catalog.id,
              catalogName: catalog.name,
              valuation,
              totalStreams: aggregate.totalStreams,
              measuredSongCount: aggregate.measuredSongCount,
              catalogAgeYears,
              ageFlooredToOneYear,
              artist: searchedArtist,
            })
              .then(toValuationEmailOutcome)
              .catch(error => {
                console.error("Valuation report email failed:", error);
                return {
                  status: "failed" as const,
                  error: error instanceof Error ? error.message : String(error),
                };
              })
          : { status: "skipped", reason: aggregate ? "0 streams" : "measurements unavailable" };

      await captureValuationLead({
        accountId,
        artistName: searchedArtist?.name ?? "Unknown artist",
        artistId: spotify_artist_id,
        valueBand: valuation,
        lifetimeStreams: aggregate?.totalStreams ?? undefined,
        followerCount: searchedArtist?.followers?.total ?? undefined,
        rosterArtistId,
        rosterAttachError,
        emailOutcome,
      }).catch(error => console.error("Valuation lead capture failed:", error));
    });

    return successResponse({
      catalog,
      band: valuation,
      // The measured ISRC count: an idempotent re-run adds nothing to the
      // reused catalog but its tracks are still measured; identical to
      // songsAdded on the fresh path.
      songs_measured: isrcs.length,
    });
  } catch (error) {
    console.error("Error running valuation:", error);
    return errorResponse("Internal server error", 500);
  }
}
