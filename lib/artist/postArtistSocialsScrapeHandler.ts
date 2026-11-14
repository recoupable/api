import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { errorResponse } from "@/lib/networking/errorResponse";
import { validateArtistSocialsScrapeBody } from "@/lib/artist/validateArtistSocialsScrapeBody";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { runArtistSocialsScrape } from "@/lib/artist/runArtistSocialsScrape";
import { buildInsufficientCreditsResponse } from "@/lib/credits/buildInsufficientCreditsResponse";

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

    const result = await runArtistSocialsScrape({
      accountId: authResult.accountId,
      artistAccountId: validatedBody.artist_account_id,
      posts: validatedBody.posts,
    });

    if (result.kind === "forbidden") {
      return errorResponse("Unauthorized artist socials scrape attempt", 403);
    }
    if (result.kind === "insufficient_credits") {
      return NextResponse.json(buildInsufficientCreditsResponse(result), {
        status: 402,
        headers: getCorsHeaders(),
      });
    }

    return NextResponse.json(result.runs, {
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
