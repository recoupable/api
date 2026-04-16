import { type NextRequest, NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { errorResponse } from "@/lib/networking/errorResponse";

export type ValidatedGetResearchAlbumsRequest = {
  accountId: string;
  artistId: string;
  isPrimary: string;
  limit: string | undefined;
  offset: string | undefined;
};

const VALID_BOOLEAN = ["true", "false"] as const;

/**
 * Validates `GET /api/research/albums` — auth + required numeric `artist_id`
 * (Chartmetric artist ID). Optional `is_primary` (defaults to `"true"`) maps
 * to Chartmetric's `isPrimary` filter, which when true returns only albums
 * where the artist is a main artist — excluding DJ compilations, soundtracks,
 * and feature appearances. Optional `limit` and `offset` for pagination.
 *
 * @param request - The incoming HTTP request.
 */
export async function validateGetResearchAlbumsRequest(
  request: NextRequest,
): Promise<NextResponse | ValidatedGetResearchAlbumsRequest> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(request.url);
  const artistId = searchParams.get("artist_id");
  if (!artistId) return errorResponse("artist_id parameter is required", 400);
  if (!/^[1-9]\d*$/.test(artistId))
    return errorResponse("artist_id must be a positive integer", 400);

  const isPrimary = searchParams.get("is_primary") ?? "true";
  if (!(VALID_BOOLEAN as readonly string[]).includes(isPrimary)) {
    return errorResponse(`is_primary must be "true" or "false"`, 400);
  }

  const limit = searchParams.get("limit") ?? undefined;
  if (limit !== undefined && !/^[1-9]\d*$/.test(limit)) {
    return errorResponse("limit must be a positive integer", 400);
  }

  const offset = searchParams.get("offset") ?? undefined;
  if (offset !== undefined && !/^(0|[1-9]\d*)$/.test(offset)) {
    return errorResponse("offset must be a non-negative integer", 400);
  }

  return { accountId: authResult.accountId, artistId, isPrimary, limit, offset };
}
