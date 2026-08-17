import { type NextRequest, NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { errorResponse } from "@/lib/networking/errorResponse";
import { MAX_ISRCS_PER_REQUEST } from "@/lib/apple/getAppleSongsByIsrc";
import { APPLE_STOREFRONTS, DEFAULT_STOREFRONT } from "@/lib/apple/storefronts";

/** Two-letter country, three-character registrant, two-digit year, five-digit designation. */
const ISRC_PATTERN = /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/;

export type ValidatedGetAppleSongsRequest = {
  accountId: string;
  isrcs: string[];
  storefront: string;
};

/**
 * Validates `GET /api/apple/songs` — auth, the `isrc` list, and `storefront`.
 *
 * Auth only, with no `checkAccountArtistAccess`, matching the precedent in
 * `validateGetSongsRequest`: ISRC-keyed song metadata is DSP-public, so
 * per-artist scoping would not meaningfully reduce exposure.
 *
 * The ISRC format check is load-bearing rather than cosmetic. Apple answers a
 * malformed ISRC with `200` and an empty result, which is indistinguishable
 * from a genuine takedown — without rejecting it here, a typo would be reported
 * to a customer as their recording having gone dark.
 *
 * @param request - The incoming HTTP request.
 * @returns The validated params, or a NextResponse carrying the failure.
 */
export async function validateGetAppleSongsRequest(
  request: NextRequest,
): Promise<NextResponse | ValidatedGetAppleSongsRequest> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(request.url);

  const rawIsrcs = (searchParams.get("isrc") ?? "")
    .split(",")
    .map(value => value.trim().toUpperCase())
    .filter(Boolean);

  if (rawIsrcs.length === 0) {
    return errorResponse("isrc parameter is required", 400);
  }

  const invalid = rawIsrcs.find(isrc => !ISRC_PATTERN.test(isrc));
  if (invalid) {
    return errorResponse(`isrc must be a valid ISRC: ${invalid}`, 400);
  }

  const isrcs = [...new Set(rawIsrcs)];
  if (isrcs.length > MAX_ISRCS_PER_REQUEST) {
    return errorResponse(
      `A maximum of ${MAX_ISRCS_PER_REQUEST} ISRCs may be requested at once; received ${isrcs.length}`,
      400,
    );
  }

  const storefront = (searchParams.get("storefront") ?? DEFAULT_STOREFRONT).trim().toLowerCase();
  if (!APPLE_STOREFRONTS.has(storefront)) {
    return errorResponse(`Unknown Apple Music storefront: ${storefront}`, 400);
  }

  return { accountId: authResult.accountId, isrcs, storefront };
}
