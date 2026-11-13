import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { errorResponse } from "@/lib/networking/errorResponse";
import { validateArtistSocialsScrapeBody } from "@/lib/artist/validateArtistSocialsScrapeBody";
import { selectAccountSocials } from "@/lib/supabase/account_socials/selectAccountSocials";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { checkAccountArtistAccess } from "@/lib/artists/checkAccountArtistAccess";
import { ensureSocialScrapeCredits } from "@/lib/socials/ensureSocialScrapeCredits";
import { startArtistSocialsScrape } from "@/lib/artist/startArtistSocialsScrape";
import { getSocialScrapeCreditCost } from "@/lib/socials/getSocialScrapeCreditCost";
import { endpointModelId } from "@/lib/credits/endpointModelId";

/**
 * Handler for scraping artist social profiles.
 *
 * Body parameters:
 * - artist_account_id (required): The unique identifier of the artist account
 * - posts (optional): Recent-posts depth forwarded to each platform scraper
 *
 * Costs 50,000 + 10,000 × requested posts micro-dollar credits per profile.
 * Credits are gated up-front against the number of linked profiles and
 * deducted for the profiles whose scrape actually started.
 *
 * @param request - The request object containing the body with artist_account_id.
 * @returns A NextResponse with scraping results.
 */
export async function postArtistSocialsScrapeHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();

    const validatedBody = validateArtistSocialsScrapeBody(body);
    if (validatedBody instanceof NextResponse) {
      return validatedBody;
    }

    const authResult = await validateAuthContext(request);
    if (authResult instanceof NextResponse) return authResult;

    const hasAccess = await checkAccountArtistAccess(
      authResult.accountId,
      validatedBody.artist_account_id,
    );
    if (!hasAccess) {
      return errorResponse("Unauthorized artist socials scrape attempt", 403);
    }

    const socials = await selectAccountSocials({ accountId: validatedBody.artist_account_id });

    if (!socials.length) {
      return NextResponse.json([], {
        status: 200,
        headers: getCorsHeaders(),
      });
    }

    const costPerProfile = getSocialScrapeCreditCost(validatedBody.posts);
    const short = await ensureSocialScrapeCredits(
      authResult.accountId,
      costPerProfile * socials.length,
    );
    if (short) return short;

    const results = await startArtistSocialsScrape({
      accountId: authResult.accountId,
      socials,
      posts: validatedBody.posts,
      costPerProfile,
      modelId: endpointModelId(request, "/api/artist/socials/scrape"),
    });

    return NextResponse.json(results, {
      status: 200,
      headers: getCorsHeaders(),
    });
  } catch (error) {
    console.error("[ERROR] postArtistSocialsScrapeHandler error:", error);
    return NextResponse.json(
      {
        status: "error",
        message: "Internal server error",
      },
      {
        status: 500,
        headers: getCorsHeaders(),
      },
    );
  }
}
