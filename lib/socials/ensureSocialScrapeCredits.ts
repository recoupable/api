import { NextResponse } from "next/server";
import { ensureCreditsOrShortCircuit } from "@/lib/credits/ensureCreditsOrShortCircuit";
import { CREDIT_AUTO_RECHARGE_FALLBACK_SUCCESS_URL } from "@/lib/credits/const";

/**
 * Per-route credit gate for the social scrape endpoints. Checks the account
 * can cover `credits` (auto-recharging via a saved card if needed) before any
 * Apify run is started. Returns a 402 NextResponse the caller can `return`
 * directly, or `null` to signal "you're good, proceed." Deduction happens
 * after the scrape starts, via `deductSocialScrapeCredits`.
 */
export function ensureSocialScrapeCredits(
  accountId: string,
  credits: number,
): Promise<NextResponse | null> {
  return ensureCreditsOrShortCircuit({
    accountId,
    creditsToDeduct: credits,
    successUrl: CREDIT_AUTO_RECHARGE_FALLBACK_SUCCESS_URL,
  });
}
