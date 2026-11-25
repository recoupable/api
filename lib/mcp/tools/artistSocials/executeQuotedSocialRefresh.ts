import { startArtistSocialsScrape } from "@/lib/artist/startArtistSocialsScrape";
import type { StartArtistSocialsScrapeParams } from "@/lib/artist/startArtistSocialsScrape";
import type { RunArtistSocialsScrapeResult } from "@/lib/artist/runArtistSocialsScrape";
import { creditsToUsd } from "@/lib/credits/creditsToUsd";
import { checkCreditsAvailable } from "@/lib/credits/checkCreditsAvailable";
import { socialRefreshQuoteStore } from "./socialRefreshQuoteStore";

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
  | { kind: "busy" };

/** Validate the approved maximum and consume the quote before dispatching jobs. */
export async function executeQuotedSocialRefresh(
  params: StartArtistSocialsScrapeParams,
  artistId: string,
  approvedQuote: string | undefined,
): Promise<QuotedSocialRefreshResult> {
  const { accountId, socials, posts, costPerProfile } = params;
  const profileCount = socials.length;
  const maximumCredits = costPerProfile * profileCount;
  const targets = socials
    .map(({ social }) => JSON.stringify([social?.id, social?.profile_url, social?.username]))
    .sort();
  const quote = socialRefreshQuoteStore(
    accountId,
    JSON.stringify({ artistId, targets, posts, maximumCredits }),
  );

  if (!approvedQuote) {
    return {
      kind: "quote",
      ...(await quote.issue()),
      profileCount,
      maximumCredits,
      maximumUsd: creditsToUsd(maximumCredits),
    };
  }

  const claim = await quote.claim(approvedQuote);
  if (claim === "invalid") return { kind: "invalid_quote" };
  if (claim === "busy") return { kind: "busy" };

  try {
    const gate = await checkCreditsAvailable({ accountId, creditsToDeduct: maximumCredits });
    if (gate.kind === "insufficient_credits") return gate;
    const runs = await startArtistSocialsScrape(params);
    return { kind: "started", runs };
  } finally {
    try {
      await quote.release(approvedQuote);
    } catch (error) {
      console.error("[social refresh] could not release execution lock", error);
    }
  }
}
