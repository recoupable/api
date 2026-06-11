import { recordCreditDeduction } from "@/lib/credits/recordCreditDeduction";

/** Credits charged per successful read-only research call. */
const RESEARCH_CREDIT_COST = 5;

/**
 * Deduct research credits for a successful read. Failures are logged, never
 * thrown — a billing hiccup must not fail a response we already have.
 *
 * @param accountId - The account to charge
 */
export async function deductCredits(accountId: string): Promise<void> {
  try {
    await recordCreditDeduction({
      accountId,
      creditsToDeduct: RESEARCH_CREDIT_COST,
      source: "api",
    });
  } catch (error) {
    console.error("[research] credit deduction failed:", error);
  }
}
