import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/networking/errorResponse";
import { validationErrorResponse } from "@/lib/zod/validationErrorResponse";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { selectSocials } from "@/lib/supabase/socials/selectSocials";
import { selectAccountSocials } from "@/lib/supabase/account_socials/selectAccountSocials";
import { checkAccountArtistAccess } from "@/lib/artists/checkAccountArtistAccess";
import { ensureSocialScrapeCredits } from "@/lib/socials/ensureSocialScrapeCredits";
import { getSocialScrapeCreditCost } from "@/lib/socials/getSocialScrapeCreditCost";

export const postSocialScrapeParamsSchema = z.object({
  social_id: z.string().uuid("social_id must be a valid UUID"),
  posts: z.coerce
    .number()
    .int("posts must be an integer")
    .min(1, "posts must be between 1 and 100")
    .max(100, "posts must be between 1 and 100")
    .optional(),
});

export type PostSocialScrapeParams = z.infer<typeof postSocialScrapeParamsSchema> & {
  account_id: string;
};

export async function validatePostSocialScrapeRequest(
  request: NextRequest,
  id: string,
): Promise<PostSocialScrapeParams | NextResponse> {
  const parsed = postSocialScrapeParamsSchema.safeParse({
    social_id: id,
    posts: request.nextUrl.searchParams.get("posts") ?? undefined,
  });
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

  const short = await ensureSocialScrapeCredits(
    authResult.accountId,
    getSocialScrapeCreditCost(parsed.data.posts),
  );
  if (short) return short;

  return { social_id, posts: parsed.data.posts, account_id: authResult.accountId };
}
