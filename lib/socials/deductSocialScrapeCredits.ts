import { recordCreditDeduction } from "@/lib/credits/recordCreditDeduction";

/**
 * Deduct credits for a scrape whose Apify run(s) started. Failures are logged,
 * never thrown — a billing hiccup must not fail a scrape that is already
 * running (mirrors the research family's deduction).
 */
export async function deductSocialScrapeCredits(accountId: string, credits: number): Promise<void> {
  try {
    await recordCreditDeduction({
      accountId,
      creditsToDeduct: credits,
      source: "api",
    });
  } catch (error) {
    console.error("[socials] scrape credit deduction failed:", error);
  }
}
