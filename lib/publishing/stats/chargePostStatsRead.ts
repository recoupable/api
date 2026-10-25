import { recordCreditDeduction } from "@/lib/credits/recordCreditDeduction";
import { POST_STATS_CREDITS } from "@/lib/publishing/stats/postStatsCredits";

/**
 * Charge a successful post stats read, recorded like a post publish
 * (publishPostWorkflow). recordCreditDeduction never throws, so billing
 * cannot fail a read that already succeeded.
 *
 * @param accountId - The caller's account.
 * @param platform - The post's platform.
 * @param postUrl - The post whose numbers were read.
 */
export async function chargePostStatsRead(
  accountId: string,
  platform: string,
  postUrl: string,
): Promise<void> {
  await recordCreditDeduction({
    accountId,
    creditsToDeduct: POST_STATS_CREDITS,
    source: "api",
    provider: "composio",
    modelId: `posts/${platform}/stats`,
    resourceUrl: postUrl,
  });
}
