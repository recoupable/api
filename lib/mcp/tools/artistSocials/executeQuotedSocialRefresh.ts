import { startArtistSocialsScrape } from "@/lib/artist/startArtistSocialsScrape";
import type { StartArtistSocialsScrapeParams } from "@/lib/artist/startArtistSocialsScrape";
import type { RunArtistSocialsScrapeResult } from "@/lib/artist/runArtistSocialsScrape";
import { creditsToUsd } from "@/lib/credits/creditsToUsd";
import { checkCreditsAvailable } from "@/lib/credits/checkCreditsAvailable";
import { claimSocialRefreshQuote } from "./claimSocialRefreshQuote";
import { createSocialRefreshQuote } from "./createSocialRefreshQuote";

export type QuotedSocialRefreshResult =
  | RunArtistSocialsScrapeResult
  | {
      kind: "quote";
      token: string;
      expiresAt: number;
      profileCount: number;
      maximumCredits: number;
      maximumUsd: number;
    }
  | { kind: "invalid_quote" }
  | { kind: "used_quote" };

/** Validate the approved maximum and consume the quote before dispatching jobs. */
export async function executeQuotedSocialRefresh(
  params: StartArtistSocialsScrapeParams,
  artistId: string,
  approvedQuote: string | undefined,
): Promise<QuotedSocialRefreshResult> {
  const { accountId, socials, posts, costPerProfile } = params;
  const profileCount = socials.length;
  const maximumCredits = costPerProfile * profileCount;
  const quote = createSocialRefreshQuote({
    accountId,
    artistId,
    targets: socials
      .map(({ social }) => JSON.stringify([social?.id, social?.profile_url, social?.username]))
      .sort(),
    posts,
    maximumCredits,
  });

  if (!approvedQuote) {
    return {
      kind: "quote",
      ...quote.issue(),
      profileCount,
      maximumCredits,
      maximumUsd: creditsToUsd(maximumCredits),
    };
  }

  const claims = quote.verify(approvedQuote);
  if (!claims) return { kind: "invalid_quote" };

  const gate = await checkCreditsAvailable({ accountId, creditsToDeduct: maximumCredits });
  if (gate.kind === "insufficient_credits") return gate;
  if (!(await claimSocialRefreshQuote(claims.id, claims.expiresAt))) return { kind: "used_quote" };

  const runs = await startArtistSocialsScrape(params);
  return { kind: "started", runs };
}
