import { ensureCreditsOrShortCircuit } from "@/lib/credits/ensureCreditsOrShortCircuit";
import { CREDIT_AUTO_RECHARGE_FALLBACK_SUCCESS_URL } from "@/lib/credits/const";

/**
 * Credits charged per web-search call. Priced separately from the research
 * family's 5: the upstream Perplexity Search API costs a flat $0.005/request,
 * so 1 credit keeps margin without punishing high-frequency agentic search
 * (chat#1861). Songstats-backed research endpoints stay on
 * `ensureResearchCredits` at 5.
 */
const WEB_RESEARCH_CREDIT_COST = 1;

/**
 * Per-route credit gate for `POST /api/research/web`. Returns a 402
 * NextResponse the route can `return` directly, or `null` to proceed.
 */
export const ensureWebResearchCredits = (accountId: string) =>
  ensureCreditsOrShortCircuit({
    accountId,
    creditsToDeduct: WEB_RESEARCH_CREDIT_COST,
    successUrl: CREDIT_AUTO_RECHARGE_FALLBACK_SUCCESS_URL,
  });
