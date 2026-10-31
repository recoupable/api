import { usdToCredits } from "@/lib/credits/usdToCredits";
import { PRICES_USD } from "@/lib/credits/pricesUsd";

/** Base credits charged per social scrape (matches the research family's flat rate). */
export const SOCIAL_SCRAPE_BASE_CREDIT_COST = usdToCredits(PRICES_USD.socialScrapeBase);

/**
 * One profile scrape costs $0.05 base plus $0.01 per requested post.
 * The ledger uses micro-dollar credits: 50,000 + 10,000 × posts.
 * Omitting posts charges the base even when a platform fetches a default depth.
 */
export function getSocialScrapeCreditCost(posts?: number): number {
  return (
    SOCIAL_SCRAPE_BASE_CREDIT_COST + (posts ?? 0) * usdToCredits(PRICES_USD.socialScrapePerPost)
  );
}
