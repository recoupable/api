import { ensureCreditsOrShortCircuit } from "@/lib/credits/ensureCreditsOrShortCircuit";
import { usdToCredits } from "@/lib/credits/usdToCredits";
import { PRICES_USD } from "@/lib/credits/pricesUsd";

/**
 * Credits charged per web-search call. Priced separately from the research
 * family's 5: the upstream Perplexity Search API costs a flat $0.005/request,
 * so 1 credit keeps margin without punishing high-frequency agentic search
 * (chat#1861). The measurement-store research endpoints stay on
 * `ensureResearchCredits` at 5.
 */
const WEB_RESEARCH_CREDIT_COST = usdToCredits(PRICES_USD.researchWeb);

/**
 * Per-route credit gate for `POST /api/research/web`. Returns a 402
 * NextResponse the route can `return` directly, or `null` to proceed.
 */
export const ensureWebResearchCredits = (accountId: string) =>
  ensureCreditsOrShortCircuit({
    accountId,
    creditsToDeduct: WEB_RESEARCH_CREDIT_COST,
  });
