import { checkAccountArtistAccess } from "@/lib/artists/checkAccountArtistAccess";
import { selectAccountSocials } from "@/lib/supabase/account_socials/selectAccountSocials";
import { getSocialScrapeCreditCost } from "@/lib/socials/getSocialScrapeCreditCost";
import { checkCreditsAvailable } from "@/lib/credits/checkCreditsAvailable";
import {
  startArtistSocialsScrape,
  type StartedArtistSocialsScrape,
  type StartArtistSocialsScrapeParams,
} from "@/lib/artist/startArtistSocialsScrape";
import { ARTIST_SOCIALS_SCRAPE_MODEL_ID } from "@/lib/const";

export interface RunArtistSocialsScrapeParams<Result> {
  /** The authenticated account that pays for and owns the scrape runs. */
  accountId: string;
  /** The artist whose linked socials should be scraped. */
  artistAccountId: string;
  /** Optional recent-posts depth forwarded to each platform scraper. */
  posts?: number;
  /** Lets MCP quote and gate credits before dispatch while REST keeps its existing flow. */
  execute?: (params: StartArtistSocialsScrapeParams) => Promise<Result>;
}

export type RunArtistSocialsScrapeResult =
  | { kind: "forbidden" }
  | { kind: "insufficient_credits"; remainingCredits: number; requiredCredits: number }
  | { kind: "started"; runs: StartedArtistSocialsScrape[] };

/**
 * Authorize artist access and load the linked profiles and per-profile price.
 * REST checks the balance and starts the work. MCP delegates to its quote flow.
 *
 * @param params - See {@link RunArtistSocialsScrapeParams}.
 * @returns The authorization, quote or scrape outcome.
 */
export async function runArtistSocialsScrape<Result = never>({
  accountId,
  artistAccountId,
  posts,
  execute,
}: RunArtistSocialsScrapeParams<Result>): Promise<RunArtistSocialsScrapeResult | Result> {
  if (!(await checkAccountArtistAccess(accountId, artistAccountId))) {
    return { kind: "forbidden" };
  }

  const socials = await selectAccountSocials({ accountId: artistAccountId });
  if (!socials.length) return { kind: "started", runs: [] };

  const costPerProfile = getSocialScrapeCreditCost(posts);
  const params = {
    accountId,
    socials,
    posts,
    costPerProfile,
    modelId: ARTIST_SOCIALS_SCRAPE_MODEL_ID,
  };
  if (execute) return execute(params);

  const gate = await checkCreditsAvailable({
    accountId,
    creditsToDeduct: costPerProfile * socials.length,
  });
  if (gate.kind === "insufficient_credits") {
    return {
      kind: "insufficient_credits",
      remainingCredits: gate.remainingCredits,
      requiredCredits: gate.requiredCredits,
    };
  }

  const runs = await startArtistSocialsScrape(params);
  return { kind: "started", runs };
}
