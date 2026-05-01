import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { selectSocials } from "@/lib/supabase/socials/selectSocials";
import { scrapeProfileUrl } from "@/lib/apify/scrapeProfileUrl";
import { validatePostSocialScrapeRequest } from "@/lib/socials/validatePostSocialScrapeRequest";

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
