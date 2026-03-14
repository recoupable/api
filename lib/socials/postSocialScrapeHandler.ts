import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { selectSocials } from "@/lib/supabase/socials/selectSocials";
import { scrapeProfileUrl } from "@/lib/apify/scrapeProfileUrl";
import { validateSocialScrapeBody } from "@/lib/socials/validateSocialScrapeBody";

/**
 * Handler for scraping a single social profile by social_id.
 *
 * Body parameters:
 * - social_id (required): The unique identifier of the social profile
 *
 * @param request - The request object containing the body with social_id.
 * @returns A NextResponse with scraping results (runId and datasetId).
 */
export async function postSocialScrapeHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();

    const validatedBody = validateSocialScrapeBody(body);
    if (validatedBody instanceof NextResponse) {
      return validatedBody;
    }

    const socials = await selectSocials({ id: validatedBody.social_id });
    const social = socials?.[0];

    if (!social) {
      return NextResponse.json(
        {
          status: "error",
          error: `Social profile not found for id: ${validatedBody.social_id}`,
        },
        {
          status: 404,
          headers: getCorsHeaders(),
        },
      );
    }

    const scrapeResult = await scrapeProfileUrl(social.profile_url, social.username);

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
      } else {
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
