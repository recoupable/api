import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { validateAccountParams } from "@/lib/accounts/validateAccountParams";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import {
  validateGetSegmentsQuery,
  type GetSegmentsQuery,
} from "@/lib/artists/segments/validateGetSegmentsQuery";

export interface GetArtistSegmentsRequest {
  artistId: string;
  requesterAccountId: string;
  query: GetSegmentsQuery;
}

/**
 * Validates GET /api/artists/{id}/segments: path id, authentication, and
 * pagination query parameters.
 *
 * @param request - The incoming request
 * @param id - The artist account ID from the route
 * @returns The validated request context, or a NextResponse error
 */
export async function validateGetArtistSegmentsRequest(
  request: NextRequest,
  id: string,
): Promise<GetArtistSegmentsRequest | NextResponse> {
  const validatedParams = validateAccountParams(id);
  if (validatedParams instanceof NextResponse) {
    return validatedParams;
  }

  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { searchParams } = new URL(request.url);
  const validatedQuery = validateGetSegmentsQuery(searchParams);
  if (validatedQuery instanceof NextResponse) {
    return validatedQuery;
  }

  return {
    artistId: validatedParams.id,
    requesterAccountId: authResult.accountId,
    query: validatedQuery,
  };
}
