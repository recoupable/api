import { assertFirstChatEffectAttempt } from "./assertFirstChatEffectAttempt";
import { FatalError } from "workflow";
import type { UIMessage } from "ai";
import { encodeProjectionEvidence } from "@/lib/chat/projection/encodeProjectionEvidence";
/** A projection requires exact message acknowledgement. Unknown outcomes never retry provider/write automatically. */
export async function persistProjectedAssistantStep(chatId: string, message: UIMessage) {
  "use step";

  assertFirstChatEffectAttempt("message-write");
  try {
    const { upsertChatMessage } = await import("@/lib/supabase/chat_messages/upsertChatMessage");
    const result = await upsertChatMessage(
      { id: message.id, chat_id: chatId, role: "assistant", parts: message as never },
      { update: true },
    );
    if (
      !result.ok ||
      !result.row ||
      result.row.id !== message.id ||
      result.row.chat_id !== chatId ||
      result.row.role !== "assistant" ||
      encodeProjectionEvidence(result.row.parts, 16_777_216) !==
        encodeProjectionEvidence(message, 16_777_216)
    )
      throw new Error("Unconfirmed message");
  } catch {
    throw new FatalError("Required projection persistence requires reconciliation");
  }
  // Activity metadata is independent of the confirmed message write.
  const activityAt = new Date().toISOString();
  try {
    const { updateChat } = await import("@/lib/supabase/chats/updateChat");
    await updateChat(
      { id: chatId },
      { updated_at: activityAt, last_assistant_message_at: activityAt },
    );
  } catch {
    /* Message ACK remains valid. */
  }
}
