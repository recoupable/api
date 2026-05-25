import { nanoid } from "nanoid";
import { computeCreditsDeductedCents } from "@/lib/credits/computeCreditsDeductedCents";
import { deductCreditsWithAudit } from "@/lib/supabase/credits_usage/deductCreditsWithAudit";

/**
 * Duck-typed shape of the assembled assistant message we read off the
 * workflow result. Intentionally loose — both AI SDK's `UIMessage` and
 * the in-test fixtures satisfy it. The actual bill comes from
 * `metadata.totalMessageCost` (gateway-reported USD, the same number
 * the chat UI displays) and `metadata.totalMessageUsage` (token
 * counts). When metadata is missing we silently no-op.
 */
type AssistantMessageForUsage = {
  metadata?: {
    totalMessageCost?: number;
    totalMessageUsage?: {
      inputTokens?: number;
      cachedInputTokens?: number;
      outputTokens?: number;
    };
  };
};

/**
 * Fire-and-forget billing step run at the end of a chat workflow.
 * Mirrors open-agents' `recordWorkflowUsage` main-agent path
 * (apps/web/app/workflows/chat-post-finish.ts) — without this step,
 * every chat turn on `/api/chat/workflow` is free (recoupable/api#605).
 *
 * Wallet debit + audit row are atomic via the
 * `deduct_credits_with_audit` Postgres function (one transaction).
 * Errors are caught + logged so a transient credits-table outage
 * never aborts the chat workflow.
 *
 * NOTE: Sub-agent (task tool) attribution is a separate follow-up —
 * this step only charges the main-agent turn. The audit row is
 * tagged `agent_type='main'`.
 */
export async function recordChatUsage(input: {
  accountId: string;
  modelId: string;
  responseMessage: AssistantMessageForUsage | undefined;
}): Promise<void> {
  "use step";
  console.log("[recordChatUsage] enter", {
    accountId: input.accountId,
    modelId: input.modelId,
    hasResponseMessage: input.responseMessage !== undefined,
  });
  try {
    const metadata = input.responseMessage?.metadata;
    if (!metadata) {
      console.log("[recordChatUsage] skip: no metadata on responseMessage", {
        accountId: input.accountId,
        modelId: input.modelId,
      });
      return;
    }

    const usage = {
      inputTokens: metadata.totalMessageUsage?.inputTokens ?? 0,
      cachedInputTokens: metadata.totalMessageUsage?.cachedInputTokens ?? 0,
      outputTokens: metadata.totalMessageUsage?.outputTokens ?? 0,
    };

    const cents = await computeCreditsDeductedCents(
      usage,
      input.modelId,
      metadata.totalMessageCost,
    );

    const provider = input.modelId.includes("/") ? input.modelId.split("/")[0] : undefined;

    const result = await deductCreditsWithAudit({
      accountId: input.accountId,
      cents,
      eventId: nanoid(),
      event: {
        source: "api",
        agent_type: "main",
        provider,
        model_id: input.modelId,
        input_tokens: usage.inputTokens,
        cached_input_tokens: usage.cachedInputTokens,
        output_tokens: usage.outputTokens,
      },
    });

    if (!result.ok) {
      console.error("[recordChatUsage] debit failed:", result.error);
      return;
    }
    console.log("[recordChatUsage] success", {
      accountId: input.accountId,
      modelId: input.modelId,
      cents,
    });
  } catch (error) {
    console.error("[recordChatUsage] unexpected error:", error);
  }
}
