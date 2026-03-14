import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { scrapeProfileUrlBatch } from "@/lib/apify/scrapeProfileUrlBatch";
import { validateArtistSocialsScrapeBody } from "@/lib/artist/validateArtistSocialsScrapeBody";
import { selectAccountSocials } from "@/lib/supabase/account_socials/selectAccountSocials";

/**
 * Handler for scraping artist social profiles.
 *
 * Body parameters:
 * - artist_account_id (required): The unique identifier of the artist account
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

    const socials = await selectAccountSocials(validatedBody.artist_account_id);

    if (!socials.length) {
      return NextResponse.json([], {
        status: 200,
        headers: getCorsHeaders(),
      });
    }

    const results = await scrapeProfileUrlBatch(
      socials.map(social => ({
        profileUrl: social.social?.profile_url,
        username: social.social?.username,
      })),
    );

    return NextResponse.json(results, {
      status: 200,
      headers: getCorsHeaders(),
    });
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
