import { NextRequest, NextResponse } from "next/server";
import {
  validateArtistAccessRequest,
  type ValidatedArtistAccessRequest,
} from "@/lib/artists/validateArtistAccessRequest";

export type DeleteArtistRequest = ValidatedArtistAccessRequest;

/**
 * Validates DELETE /api/artists/{id} path params and authentication.
 *
 * @param request - The incoming request
 * @param id - The artist account ID from the route
 * @returns The validated artist ID plus requester context, or a NextResponse error
 */
export async function validateDeleteArtistRequest(
  request: NextRequest,
  id: string,
): Promise<DeleteArtistRequest | NextResponse> {
  const validated = await validateArtistAccessRequest(request, id);
  if (validated instanceof NextResponse) {
    if (validated.status !== 403) {
      return validated;
    }

    return NextResponse.json(
      {
        status: "error",
        error: "Unauthorized delete attempt",
      },
      {
        status: 403,
        headers: validated.headers,
      },
    );
  }

  return validated;
}
