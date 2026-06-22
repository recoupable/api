import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateAccountParams } from "@/lib/accounts/validateAccountParams";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { checkAccountArtistAccess } from "@/lib/artists/checkAccountArtistAccess";
import { selectAccounts } from "@/lib/supabase/accounts/selectAccounts";

export interface DeleteArtistRequest {
  artistId: string;
  requesterAccountId: string;
}

const deleteArtistBodySchema = z.object({
  account_id: z.string().uuid("account_id must be a valid UUID").optional(),
});

/**
 * Validates DELETE /api/artists/{id} path params and authentication.
 *
 * Accepts an optional `account_id` in the request body so a caller with access
 * to multiple accounts (org members or Recoup admins) can delete an artist in
 * another account's context. The override is authorized by `validateAuthContext`.
 *
 * @param request - The incoming request
 * @param id - The artist account ID from the route
 * @returns The validated artist ID plus requester context, or a NextResponse error
 */
export async function validateDeleteArtistRequest(
  request: NextRequest,
  id: string,
): Promise<DeleteArtistRequest | NextResponse> {
  const validatedParams = validateAccountParams(id);
  if (validatedParams instanceof NextResponse) {
    return validatedParams;
  }

  const body = await safeParseJson(request);
  const bodyResult = deleteArtistBodySchema.safeParse(body);
  if (!bodyResult.success) {
    const firstError = bodyResult.error.issues[0];
    return NextResponse.json(
      {
        status: "error",
        error: firstError.message,
      },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const authResult = await validateAuthContext(request, {
    accountId: bodyResult.data.account_id,
  });
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const artistId = validatedParams.id;
  const requesterAccountId = authResult.accountId;

  const existingArtist = await selectAccounts(artistId);
  if (!existingArtist.length) {
    return NextResponse.json(
      {
        status: "error",
        error: "Artist not found",
      },
      {
        status: 404,
        headers: getCorsHeaders(),
      },
    );
  }

  const hasAccess = await checkAccountArtistAccess(requesterAccountId, artistId);
  if (!hasAccess) {
    return NextResponse.json(
      {
        status: "error",
        error: "Unauthorized delete attempt",
      },
      {
        status: 403,
        headers: getCorsHeaders(),
      },
    );
  }

  return {
    artistId,
    requesterAccountId,
  };
}
