import { FatalError } from "workflow";
import type { ChatFenceWriter } from "@/lib/chat/fence/chatFenceSchemas";

/** Success only, after all required writes. Errors retain original authority for reconciliation. */
export async function releaseFencedWorkflowStep(writer: ChatFenceWriter) {
  "use step";
  try {
    const { executeChatFenceCommand } = await import(
      "@/lib/supabase/chat_fence/executeChatFenceCommand"
    );
    const result = await executeChatFenceCommand(writer.chatId, writer.effectiveAccount, {
      action: "release",
      payload: {
        epoch: writer.epoch,
        owner: writer.owner,
        run_id: writer.runId,
        reason: "workflow_complete",
      },
    });
    if (result.ok === false || result.action !== "release" || !result.value.released)
      throw new FatalError("Fenced release requires reconciliation");
  } catch {
    throw new FatalError("Fenced release requires reconciliation");
  }
}
