import { updateChatMessage } from "@/lib/supabase/chat_messages/updateChatMessage";
import { upsertAssistantDataPart } from "@/lib/chat/upsertAssistantDataPart";

interface DataPart {
  type: string;
  id: string;
  data: unknown;
}

interface AssistantMessage {
  id: string;
  role: string;
  parts: ReadonlyArray<unknown>;
}

/**
 * Workflow-step wrapper that merges a data-part into an assistant
 * message and persists the merged message to `chat_messages.parts`.
 *
 * Carries the `"use step"` directive — the underlying
 * `updateChatMessage` Supabase helper is intentionally kept pure so
 * the step boundary lives in the chat-domain layer (this file)
 * rather than the supabase layer. Mirrors the pattern used by
 * `persistAssistantMessage` + `upsertChatMessage`.
 *
 * Use this when a `data-*` chunk lands AFTER the initial
 * `persistAssistantMessage` call already wrote the message — e.g.,
 * the auto-commit flow's resolved `data-commit` chunk that needs to
 * survive page refresh.
 *
 * Errors from the underlying supabase call are surfaced as logs;
 * this function never throws so a transient DB blip can't mark the
 * chat workflow run failed.
 */
export async function persistAssistantDataPart(
  message: AssistantMessage,
  part: DataPart,
): Promise<void> {
  "use step";
  console.log("[persistAssistantDataPart] enter", {
    messageId: message.id,
    partType: part.type,
    partId: part.id,
  });
  const merged = upsertAssistantDataPart(message, part);
  const result = await updateChatMessage(merged.id, merged);
  if (!result.ok) {
    console.error("[persistAssistantDataPart] update failed:", result.error);
    return;
  }
  console.log("[persistAssistantDataPart] persisted", {
    messageId: merged.id,
    partCount: merged.parts.length,
  });
}
