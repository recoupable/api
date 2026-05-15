import { getCreditUsage } from "./getCreditUsage";
import { recordCreditDeduction } from "./recordCreditDeduction";
import { LanguageModelUsage } from "ai";

interface HandleChatCreditsParams {
  usage: LanguageModelUsage;
  model: string;
  accountId?: string;
}

/**
 * Handles credit deduction after chat completion.
 * Always deducts at least 1 credit when accountId is present (round up from usage cost).
 * @param usage - The language model usage data
 * @param model - The model ID used for the chat
 * @param accountId - The account ID to deduct credits from (optional)
 */
export const handleChatCredits = async ({
  usage,
  model,
  accountId,
}: HandleChatCreditsParams): Promise<void> => {
  if (!accountId) {
    console.error("No account ID provided, skipping credit deduction");
    return;
  }

  try {
    const usageCost = await getCreditUsage(usage, model);
    const creditsToDeduct = Math.max(1, Math.round(usageCost * 100));

    await recordCreditDeduction({
      accountId,
      creditsToDeduct,
      source: "web",
      modelId: model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cachedInputTokens: usage.cachedInputTokens,
    });
  } catch (error) {
    console.error("Failed to handle chat credits:", error);
    // Don't throw error to avoid breaking the chat flow
  }
};
