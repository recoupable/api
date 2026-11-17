import { checkAccountArtistAccess } from "@/lib/artists/checkAccountArtistAccess";
import { selectAccountSocials } from "@/lib/supabase/account_socials/selectAccountSocials";
import { getSocialScrapeCreditCost } from "@/lib/socials/getSocialScrapeCreditCost";
import { checkCreditsAvailable } from "@/lib/credits/checkCreditsAvailable";
import {
  startArtistSocialsScrape,
  type StartedArtistSocialsScrape,
} from "@/lib/artist/startArtistSocialsScrape";
import { ARTIST_SOCIALS_SCRAPE_MODEL_ID } from "@/lib/const";

export interface RunArtistSocialsScrapeParams {
  /** The authenticated account that pays for and owns the scrape runs. */
  accountId: string;
  /** The artist whose linked socials should be scraped. */
  artistAccountId: string;
  /** Optional recent-posts depth forwarded to each platform scraper. */
  posts?: number;
}

export type RunArtistSocialsScrapeResult =
  | { kind: "forbidden" }
  | { kind: "insufficient_credits"; remainingCredits: number; requiredCredits: number }
  | { kind: "started"; runs: StartedArtistSocialsScrape[] };

/**
 * Runs an artist socials scrape end to end: checks the caller can access the
 * artist, loads the linked socials, gates credits for every linked profile,
 * then starts the scrape (which charges only the profiles that started).
 * Shared by `POST /api/artist/socials/scrape` and the `scrape_artist_socials`
 * MCP tool, which map the result to their own response shapes.
 *
 * @param params - See {@link RunArtistSocialsScrapeParams}.
 * @returns `forbidden`, the credit shortfall, or the started runs (empty when
 *   the artist has no linked socials).
 */
export async function runArtistSocialsScrape({
  accountId,
  artistAccountId,
  posts,
}: RunArtistSocialsScrapeParams): Promise<RunArtistSocialsScrapeResult> {
  if (!(await checkAccountArtistAccess(accountId, artistAccountId))) {
    return { kind: "forbidden" };
  }

  const socials = await selectAccountSocials({ accountId: artistAccountId });
  if (!socials.length) return { kind: "started", runs: [] };

  const costPerProfile = getSocialScrapeCreditCost(posts);
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

  const runs = await startArtistSocialsScrape({
    accountId,
    socials,
    posts,
    costPerProfile,
    modelId: ARTIST_SOCIALS_SCRAPE_MODEL_ID,
  });
  return { kind: "started", runs };
}
