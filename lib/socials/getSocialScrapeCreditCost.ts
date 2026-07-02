/** Base credits charged per social scrape (matches the research family's flat rate). */
export const SOCIAL_SCRAPE_BASE_CREDIT_COST = 5;

/**
 * Credits for one profile scrape: 5 base + 1 per requested post. Priced from
 * measured Apify costs (see recoupable/chat#1836): the worst case is YouTube at
 * ~$0.003 × 2×posts dataset items, so 5 + posts credits (1 credit = $0.01)
 * keeps ≥1.75× margin at posts=100 while staying one rule for every platform.
 */
export function getSocialScrapeCreditCost(posts?: number): number {
  return SOCIAL_SCRAPE_BASE_CREDIT_COST + (posts ?? 0);
}
