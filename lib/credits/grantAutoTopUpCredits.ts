import { incrementRemainingCredits } from "@/lib/supabase/credits_usage/incrementRemainingCredits";
import { insertUsageEvent } from "@/lib/supabase/usage_events/insertUsageEvent";

interface GrantAutoTopUpCreditsParams {
  accountId: string;
  /** Credit micro-dollars. */
  credits: number;
  paymentIntentId: string;
}

/**
 * Applies a paid auto top-up: raises the balance first (the money has moved),
 * then records it on the meter as a negative deduction so the usage page shows
 * the top-up beside the charges it covers.
 */
export async function grantAutoTopUpCredits({
  accountId,
  credits,
  paymentIntentId,
}: GrantAutoTopUpCreditsParams): Promise<void> {
  await incrementRemainingCredits({ accountId, delta: credits });
  try {
    await insertUsageEvent({
      account_id: accountId,
      source: "api",
      agent_type: "main",
      provider: "stripe",
      model_id: "auto_topup",
      credits_deducted: -credits,
      input_tokens: 0,
      cached_input_tokens: 0,
      output_tokens: 0,
      tool_call_count: 0,
      resource_url: "/billing",
    });
  } catch (error) {
    console.error(`[grantAutoTopUpCredits] usage event failed for ${paymentIntentId}:`, error);
  }
}
