import { type NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { successResponse } from "@/lib/networking/successResponse";
import { recordCreditDeduction } from "@/lib/credits/recordCreditDeduction";
import { getArtists } from "@/lib/artists/getArtists";
import { getArtistBandsintownId } from "@/lib/research/getArtistBandsintownId";
import { fetchBandsintownEvents } from "@/lib/apify/bandsintown/fetchBandsintownEvents";
import { validatePostResearchEventsRequest } from "@/lib/research/validatePostResearchEventsRequest";

/**
 * Returned when the artist is reachable but has no Bandsintown profile
 * connected. States the exact URL format and links the field that accepts it,
 * so the caller can fix it without opening a support thread.
 */
const NO_BANDSINTOWN_ID_ERROR =
  "Error: no bandsintown ID connected to this artist. " +
  "Please connect the bandsintown ID in this format: bandsintown.com/a/{id}-{slug} " +
  "Docs here: https://docs.recoupable.dev/api-reference/artists/update#body-profile-urls";

/**
 * Artist events handler — returns a Recoup artist's live shows.
 *
 * The caller supplies an `artist_id`; the provider id is resolved from that
 * artist's connected socials. Two negative cases are kept deliberately
 * distinct, because collapsing them would let a missing profile read as
 * "this artist has no shows":
 *   - no profile connected (or artist not accessible) -> 404
 *   - profile connected, nothing scheduled            -> 200 with `events: []`
 *
 * @param request - JSON body with `artist_id` and optional `date`
 * @returns JSON `{ status, events }`, or an error response
 */
export async function postResearchEventsHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validatePostResearchEventsRequest(request);
    if (validated instanceof NextResponse) return validated;

    // Scope the lookup to the caller's own roster. Without this, any
    // authenticated account could read any artist's connected profile.
    //
    // `orgId` is omitted rather than passed as null when the auth context
    // carries none: getArtists treats null as "personal artists only,
    // explicitly excluding every org artist" and undefined as "personal + all
    // orgs". Passing null 404s every artist that lives in an organization,
    // which is how most customer rosters are held. An explicitly org-scoped
    // key still narrows to that org.
    const artists = await getArtists({
      accountId: validated.accountId,
      ...(validated.orgId ? { orgId: validated.orgId } : {}),
    });
    if (!artists.some(artist => artist.account_id === validated.artist_id)) {
      return errorResponse("Artist not found", 404);
    }

    const bandsintownId = await getArtistBandsintownId(validated.artist_id);
    if (!bandsintownId) {
      return errorResponse(NO_BANDSINTOWN_ID_ERROR, 404);
    }

    const events = await fetchBandsintownEvents({
      bandsintownId,
      ...(validated.date && { date: validated.date }),
    });

    try {
      await recordCreditDeduction({
        accountId: validated.accountId,
        creditsToDeduct: 1,
        source: "api",
      });
    } catch {
      // Credit deduction failed but data was fetched — don't block the response
    }

    return successResponse({ events });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Artist events lookup failed",
      500,
    );
  }
}
