import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAccountParams } from "@/lib/accounts/validateAccountParams";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { selectAccounts } from "@/lib/supabase/accounts/selectAccounts";
import { checkAccountArtistAccess } from "@/lib/artists/checkAccountArtistAccess";
import { selectAccountSocials } from "@/lib/supabase/account_socials/selectAccountSocials";

export interface DeleteArtistSocialRequest {
  artistId: string;
  socialId: string;
}

const socialIdSchema = z.string().uuid("socialId must be a valid UUID");

const errorResponse = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status, headers: getCorsHeaders() });

/**
 * Validates DELETE /api/artists/{id}/socials/{socialId} path params, auth, and
 * that the social is actually linked to the artist.
 *
 * @param request - The incoming request
 * @param id - The artist account ID from the route
 * @param socialId - The social ID from the route
 * @returns The validated ids, or a NextResponse error
 */
export async function validateDeleteArtistSocialRequest(
  request: NextRequest,
  id: string,
  socialId: string,
): Promise<DeleteArtistSocialRequest | NextResponse> {
  const validatedParams = validateAccountParams(id);
  if (validatedParams instanceof NextResponse) return validatedParams;

  const socialResult = socialIdSchema.safeParse(socialId);
  if (!socialResult.success) {
    return errorResponse(400, {
      status: "error",
      error: socialResult.error.issues[0].message,
    });
  }

  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const artistId = validatedParams.id;

  const [artist] = await selectAccounts(artistId);
  if (!artist) return errorResponse(404, { status: "error", error: "Artist not found" });

  const hasAccess = await checkAccountArtistAccess(authResult.accountId, artistId);
  if (!hasAccess) return errorResponse(403, { status: "error", error: "Unauthorized" });

  const links = await selectAccountSocials({ accountId: artistId, socialId });
  if (!links.length) {
    return errorResponse(404, {
      status: "error",
      error: "Social not linked to this artist",
    });
  }

  return { artistId, socialId };
}
