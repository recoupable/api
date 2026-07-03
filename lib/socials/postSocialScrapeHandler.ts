import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { selectSocials } from "@/lib/supabase/socials/selectSocials";
import { scrapeProfileUrl } from "@/lib/apify/scrapeProfileUrl";
import { validatePostSocialScrapeRequest } from "@/lib/socials/validatePostSocialScrapeRequest";
import { deductSocialScrapeCredits } from "@/lib/socials/deductSocialScrapeCredits";
import { getSocialScrapeCreditCost } from "@/lib/socials/getSocialScrapeCreditCost";
import { insertApifyScraperRun } from "@/lib/supabase/apify_scraper_runs/insertApifyScraperRun";

export async function postSocialScrapeHandler(
  request: NextRequest,
  id: string,
): Promise<NextResponse> {
  try {
    const validated = await validatePostSocialScrapeRequest(request, id);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const socials = await selectSocials({ id: validated.social_id });
    const social = socials?.[0];

    if (!social) {
      return NextResponse.json(
        {
          status: "error",
          error: `Social profile not found for id: ${validated.social_id}`,
        },
        {
          status: 404,
          headers: getCorsHeaders(),
        },
      );
    }

    const scrapeResult = await scrapeProfileUrl(
      social.profile_url,
      social.username,
      validated.posts,
    );

    if (scrapeResult) {
      if (scrapeResult.error) {
        return NextResponse.json(
          {
            status: "error",
            error: scrapeResult.error,
          },
          {
            status: 500,
            headers: getCorsHeaders(),
          },
        );
      }
      await deductSocialScrapeCredits(
        validated.account_id,
        getSocialScrapeCreditCost(validated.posts),
      );
      // Ownership map for GET /api/apify/runs/{runId} (chat#1840). The
      // insert logs-and-returns-null on failure, so a mapping miss only
      // degrades this run to admin-only polling — never fails the scrape.
      if (scrapeResult.runId) {
        await insertApifyScraperRun({
          run_id: scrapeResult.runId,
          account_id: validated.account_id,
          social_id: validated.social_id,
        });
      }
      return NextResponse.json(
        {
          runId: scrapeResult.runId,
          datasetId: scrapeResult.datasetId,
        },
        {
          status: 200,
          headers: getCorsHeaders(),
        },
      );
    }

    return NextResponse.json(
      {
        runId: null,
        datasetId: null,
        error: "Unsupported social media platform",
      },
      {
        status: 400,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    console.error("[ERROR] Error starting social scrape:", error);
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Internal server error",
      },
      {
        status: 500,
        headers: getCorsHeaders(),
      },
    );
  }
}
