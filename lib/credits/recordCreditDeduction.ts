import { nanoid } from "nanoid";
import { deductCreditsWithAudit } from "@/lib/supabase/credits_usage/deductCreditsWithAudit";

interface RecordCreditDeductionParams {
  accountId: string;
  creditsToDeduct: number;
  source: "web" | "api";
  agentType?: "main" | "subagent";
  provider?: string;
  modelId?: string;
  inputTokens?: number;
  cachedInputTokens?: number;
  outputTokens?: number;
  toolCallCount?: number;
}

interface RecordCreditDeductionResult {
  success: boolean;
}

/**
 * Wallet + meter atomic wrapper. Calls the `deduct_credits_with_audit`
 * Postgres function (recoupable/database#26) which runs the
 * `credits_usage` debit and the `usage_events` insert inside a single
 * transaction — either both writes commit or neither does. Eliminates
 * the wallet/meter drift risk the previous (two separate Supabase
 * calls) implementation had.
 *
 * Errors are caught and surfaced via `{ success: false }` so the
 * caller (the chat workflow or any research handler) never aborts on
 * a credit-accounting hiccup. The wallet stays authoritative — if the
 * RPC rejects, neither write happened, and the caller can decide
 * whether to retry or move on.
 */
export const recordCreditDeduction = async (
  params: RecordCreditDeductionParams,
): Promise<RecordCreditDeductionResult> => {
  "use step";
  try {
    const result = await deductCreditsWithAudit({
      accountId: params.accountId,
      cents: params.creditsToDeduct,
      eventId: nanoid(),
      event: {
        source: params.source,
        agent_type: params.agentType ?? "main",
        provider: params.provider,
        model_id: params.modelId,
        input_tokens: params.inputTokens ?? 0,
        cached_input_tokens: params.cachedInputTokens ?? 0,
        output_tokens: params.outputTokens ?? 0,
        tool_call_count: params.toolCallCount ?? 0,
      },
    });

    if (!result.ok) {
      console.error("[recordCreditDeduction] atomic debit failed:", result.error);
      return { success: false };
    }
    return { success: true };
  } catch (error) {
    console.error("[recordCreditDeduction] unexpected error:", error);
    return { success: false };
  }
};
