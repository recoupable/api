import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { errorResponse } from "@/lib/networking/errorResponse";
import { scrapeProfileUrlBatch } from "@/lib/apify/scrapeProfileUrlBatch";
import { validateArtistSocialsScrapeBody } from "@/lib/artist/validateArtistSocialsScrapeBody";
import { selectAccountSocials } from "@/lib/supabase/account_socials/selectAccountSocials";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { checkAccountArtistAccess } from "@/lib/artists/checkAccountArtistAccess";
import { ensureSocialScrapeCredits } from "@/lib/socials/ensureSocialScrapeCredits";
import { deductSocialScrapeCredits } from "@/lib/socials/deductSocialScrapeCredits";
import { upsertApifyScraperRuns } from "@/lib/supabase/apify_scraper_runs/upsertApifyScraperRuns";
import { getSocialPlatformByLink } from "@/lib/artists/getSocialPlatformByLink";
import { getSocialScrapeCreditCost } from "@/lib/socials/getSocialScrapeCreditCost";

/**
 * Handler for scraping artist social profiles.
 *
 * Body parameters:
 * - artist_account_id (required): The unique identifier of the artist account
 * - posts (optional): Recent-posts depth forwarded to each platform scraper
 *
 * Costs 5 credits plus 1 per requested post, per social profile scraped.
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

    const results = await scrapeProfileUrlBatch(
      socials.map(social => ({
        profileUrl: social.social?.profile_url,
        username: social.social?.username,
      })),
      validatedBody.posts,
    );

    if (results.length) {
      await deductSocialScrapeCredits(authResult.accountId, costPerProfile * results.length);

      // Register the batch so per-platform webhook completions can assemble
      // ONE consolidated new-posts digest instead of an email per platform
      // (chat#1855). Registration failure must not fail the scrape.
      const batchId = crypto.randomUUID();
      const socialByUrl = new Map(
        socials.map(s => [s.social?.profile_url ?? "", s.social?.id ?? null]),
      );
      await upsertApifyScraperRuns(
        results
          .filter(r => r.runId)
          .map(r => ({
            run_id: r.runId as string,
            account_id: authResult.accountId,
            social_id: r.profileUrl ? (socialByUrl.get(r.profileUrl) ?? null) : null,
            platform: r.profileUrl ? getSocialPlatformByLink(r.profileUrl).toLowerCase() : null,
            batch_id: batchId,
          })),
      );
    }

    return NextResponse.json(
      results.map(({ runId, datasetId, error }) => ({ runId, datasetId, error })),
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    console.error("[ERROR] postArtistSocialsScrapeHandler error:", error);
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Internal server error",
      },
      {
        status: 500,
        headers: getCorsHeaders(),
      },
    );
  }
}
