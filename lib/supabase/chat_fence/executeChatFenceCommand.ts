import supabase from "@/lib/supabase/serverClient";
import {
  chatFenceCommandSchema,
  chatFenceIdentitySchema,
  type ChatFenceSuccess,
} from "@/lib/chat/fence/chatFenceSchemas";
import {
  classifyChatFenceError,
  type ChatFenceFailure,
} from "@/lib/chat/fence/classifyChatFenceError";
import { parseChatFenceReceipt } from "@/lib/chat/fence/parseChatFenceReceipt";
import { encodeStrictJson } from "@/lib/chat/fence/encodeStrictJson";

/** Unwired foundation for draft Database #122. Callers must authorize the effective account. */
export async function executeChatFenceCommand(
  chatId: string,
  effectiveAccount: string,
  input: unknown,
): Promise<ChatFenceSuccess | ChatFenceFailure> {
  const identity = chatFenceIdentitySchema.safeParse({ chatId, effectiveAccount });
  if (!identity.success) return classifyChatFenceError("22023");
  let command;
  try {
    encodeStrictJson(input);
    command = chatFenceCommandSchema.parse(input);
  } catch {
    return classifyChatFenceError("22023");
  }
  try {
    // Draft RPC is intentionally absent from generated production DB types.
    // Narrow the call only here; regenerate types after an approved DB migration.
    const { data, error } = await supabase.rpc(
      "chat_fence_command" as never,
      {
        p_chat: identity.data.chatId,
        p_account: identity.data.effectiveAccount,
        p_action: command.action,
        p: command.payload,
      } as never,
    );
    if (error) return classifyChatFenceError(error.code);
    return parseChatFenceReceipt(chatId, command, data);
  } catch {
    // Transport loss can occur after commit. No automatic retries or new owner.
    return { ok: false, error: { kind: "transport_ambiguous", retrySameCommand: false } };
  }
}
