import { ensureCreditsOrShortCircuit } from "@/lib/credits/ensureCreditsOrShortCircuit";
import { usdToCredits } from "@/lib/credits/usdToCredits";
import { PRICES_USD } from "@/lib/credits/pricesUsd";

/**
 * Credits charged per artist-events call. Priced at 1 like web search rather
 * than the research family's 5: one Apify actor run costs a fraction of a cent
 * ($0.001/result row plus $0.00005/start), so a low price keeps roster-wide
 * sweeps viable — a caller fanning out across a label roster makes one call per
 * artist (chat#1954).
 */
const EVENTS_RESEARCH_CREDIT_COST = usdToCredits(PRICES_USD.researchEvents);

/**
 * Per-route credit gate for `POST /api/research/events`. Returns a 402
 * NextResponse the route can `return` directly, or `null` to proceed.
 */
export const ensureEventsResearchCredits = (accountId: string) =>
  ensureCreditsOrShortCircuit({
    accountId,
    creditsToDeduct: EVENTS_RESEARCH_CREDIT_COST,
  });
