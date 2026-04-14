import { getCreditUsage } from "./getCreditUsage";
import { deductCredits } from "./deductCredits";
import { LanguageModelUsage } from "ai";

interface HandleChatCreditsParams {
  usage: LanguageModelUsage;
  model: string;
  accountId?: string;
}

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

    await deductCredits({
      accountId,
      creditsToDeduct,
    });
  } catch (error) {
    console.error("Failed to handle chat credits:", error);
    // Don't throw error to avoid breaking the chat flow
  }
};
