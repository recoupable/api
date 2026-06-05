import { ensureCreditsOrShortCircuit } from "@/lib/credits/ensureCreditsOrShortCircuit";
import { CREDIT_AUTO_RECHARGE_FALLBACK_SUCCESS_URL } from "@/lib/credits/const";

/** Credits charged per read-only research call (artist & non-artist). */
const RESEARCH_CREDIT_COST = 5;

/**
 * Per-route credit gate for the read-only research family. Each successful
 * research call deducts {@link RESEARCH_CREDIT_COST} credits, so we make sure
 * the account has them (auto-recharging via a saved card if needed) before the
 * caller bothers hitting the external provider. Returns a 402 NextResponse the route can
 * `return` directly, or `null` to signal "you're good, proceed."
 */
export const ensureResearchCredits = (accountId: string) =>
  ensureCreditsOrShortCircuit({
    accountId,
    creditsToDeduct: RESEARCH_CREDIT_COST,
    successUrl: CREDIT_AUTO_RECHARGE_FALLBACK_SUCCESS_URL,
  });
