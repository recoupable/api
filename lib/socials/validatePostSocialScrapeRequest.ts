import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/networking/errorResponse";
import { validationErrorResponse } from "@/lib/zod/validationErrorResponse";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { selectSocials } from "@/lib/supabase/socials/selectSocials";
import { selectAccountSocials } from "@/lib/supabase/account_socials/selectAccountSocials";
import { checkAccountArtistAccess } from "@/lib/artists/checkAccountArtistAccess";

export const postSocialScrapeParamsSchema = z.object({
  social_id: z.string().uuid("social_id must be a valid UUID"),
});

export type PostSocialScrapeParams = z.infer<typeof postSocialScrapeParamsSchema>;

export async function validatePostSocialScrapeRequest(
  request: NextRequest,
  id: string,
): Promise<PostSocialScrapeParams | NextResponse> {
  const parsed = postSocialScrapeParamsSchema.safeParse({ social_id: id });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return validationErrorResponse(issue.message, issue.path);
  }

  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const social_id = parsed.data.social_id;

  const socials = await selectSocials({ id: social_id });
  if (!socials || !socials.length) {
    return errorResponse(`Social profile not found for id: ${social_id}`, 404);
  }

  // Socials are always owned by artist accounts (never directly by user accounts),
  // so access is gated entirely through checkAccountArtistAccess against each
  // owning artist — covers direct membership, shared org, and RECOUP_ORG admin.
  const links = await selectAccountSocials({ socialId: social_id, limit: 10000 });
  const owningArtistIds = links.map(l => l.account_id).filter((v): v is string => Boolean(v));

  const hasAccess =
    owningArtistIds.length > 0 &&
    (
      await Promise.all(
        owningArtistIds.map(artistId => checkAccountArtistAccess(authResult.accountId, artistId)),
      )
    ).some(Boolean);

  if (!hasAccess) {
    return errorResponse("Unauthorized social scrape attempt", 403);
  }

  return { social_id };
}
