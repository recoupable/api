import { getCreditUsage } from "./getCreditUsage";
import { recordCreditDeduction } from "./recordCreditDeduction";
import { LanguageModelUsage } from "ai";

interface HandleChatCreditsParams {
  usage: LanguageModelUsage;
  model: string;
  accountId?: string;
  /**
   * Gateway-reported total USD cost for this turn (from
   * `responseMessage.metadata.totalMessageCost`). When present and
   * positive, used directly instead of the token-based estimate so
   * the wallet debit converges with the cost label the chat UI shows.
   */
  gatewayCostUsd?: number;
  /**
   * Which surface generated the turn — used to label the
   * `usage_events` audit row. Defaults to `"web"`; the chat-workflow
   * path (`/api/chat/workflow`) passes `"api"` so admin dashboards can
   * distinguish surface in spend rollups.
   */
  source?: "web" | "api";
}

/**
 * Handles credit deduction after chat completion.
 * Always deducts at least 1 credit when accountId is present (round up from usage cost).
 *
 * Resolution order for the per-turn cost:
 *   1. `gatewayCostUsd` — gateway-reported actual USD (preferred)
 *   2. Token-based estimate via `getCreditUsage` against the gateway catalog
 *   3. 1c floor — every successful turn debits at least 1 cent
 *
 * Wallet debit + audit row insert are atomic via
 * `recordCreditDeduction` (backed by the `deduct_credits_with_audit`
 * Postgres function).
 */
export const handleChatCredits = async ({
  usage,
  model,
  accountId,
  gatewayCostUsd,
  source = "web",
}: HandleChatCreditsParams): Promise<void> => {
  if (!accountId) {
    console.error("No account ID provided, skipping credit deduction");
    return;
  }

  try {
    const usageCost = await getCreditUsage(usage, model, gatewayCostUsd);
    const creditsToDeduct = Math.max(1, Math.round(usageCost * 100));

    await recordCreditDeduction({
      accountId,
      creditsToDeduct,
      source,
      modelId: model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cachedInputTokens: usage.inputTokenDetails.cacheReadTokens,
    });
  } catch (error) {
    console.error("Failed to handle chat credits:", error);
    // Don't throw error to avoid breaking the chat flow
  }
};
