import { deductCredits } from "./deductCredits";
import { insertUsageEvent } from "@/lib/supabase/usage_events/insertUsageEvent";

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
  newBalance?: number;
}

/**
 * Wallet + meter wrapper. Debits the credits_usage balance via deductCredits,
 * then writes a usage_events row recording the wallet impact alongside any
 * token detail the caller has.
 *
 * If the audit insert fails, the deduction is preserved (already committed)
 * and the error is logged but not surfaced — the wallet stays authoritative
 * and a reconciliation job can recover the missing audit row later.
 */
export const recordCreditDeduction = async (
  params: RecordCreditDeductionParams,
): Promise<RecordCreditDeductionResult> => {
  const result = await deductCredits({
    accountId: params.accountId,
    creditsToDeduct: params.creditsToDeduct,
  });

  try {
    await insertUsageEvent({
      account_id: params.accountId,
      credits_deducted_cents: params.creditsToDeduct,
      source: params.source,
      agent_type: params.agentType ?? "main",
      provider: params.provider ?? null,
      model_id: params.modelId ?? null,
      input_tokens: params.inputTokens ?? 0,
      cached_input_tokens: params.cachedInputTokens ?? 0,
      output_tokens: params.outputTokens ?? 0,
      tool_call_count: params.toolCallCount ?? 0,
    });
  } catch (error) {
    console.error("Failed to insert usage_events row (wallet was still debited):", error);
  }

  return result;
};
