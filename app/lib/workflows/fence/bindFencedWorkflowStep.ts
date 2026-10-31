import { FatalError, getWorkflowMetadata } from "workflow";
import { chatFenceWriterSchema } from "@/lib/chat/fence/chatFenceSchemas";
import { encodeStrictJson } from "@/lib/chat/fence/encodeStrictJson";
import {
  internalWorkflowFenceSchema,
  type InternalWorkflowFence,
} from "./TrustedFencedWorkflowInput";

/** First journaled effect. Failed/ambiguous bind never enters stream/key cleanup. */
export async function bindFencedWorkflowStep(
  input: InternalWorkflowFence,
  scope: { chatId: string; accountId: string },
  runId: string,
) {
  "use step";
  try {
    const { executeChatFenceCommand } = await import(
      "@/lib/supabase/chat_fence/executeChatFenceCommand"
    );
    encodeStrictJson(input);
    const fence = internalWorkflowFenceSchema.parse(input);
    if (
      fence.authority.chatId !== scope.chatId ||
      fence.authority.effectiveAccount !== scope.accountId ||
      getWorkflowMetadata().workflowRunId !== runId
    )
      throw new FatalError("Fenced bind scope mismatch");
    const writer = chatFenceWriterSchema.parse({ ...fence.authority, runId });
    const result = await executeChatFenceCommand(writer.chatId, writer.effectiveAccount, {
      action: "bind",
      payload: {
        epoch: writer.epoch,
        owner: writer.owner,
        run_id: runId,
        attempt_id: fence.attemptId,
      },
    });
    if (result.ok === false)
      throw new FatalError(`Fenced bind requires reconciliation: ${result.error.kind}`);
    if (result.action !== "bind") throw new FatalError("Invalid fenced bind receipt");
    return { writer, turn: fence.turn };
  } catch (error) {
    if (error instanceof FatalError) throw error;
    throw new FatalError("Fenced bind requires reconciliation");
  }
}
