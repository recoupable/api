import { chatFenceCommandSchema, type ChatFenceAuthority } from "./chatFenceSchemas";
import { createChatFenceAuthority } from "./createChatFenceAuthority";
import { parseChatFenceReceipt } from "./parseChatFenceReceipt";

/** Unwired orchestration: caller must authorize principal AND execution resource first.
 * Adapters make one fresh claim RPC and one start call, without retries or cached true responses.
 */
export async function dispatchChatFenceOnce<T>(
  input: { authority: ChatFenceAuthority; attemptId: string },
  adapters: {
    claim: (command: {
      action: "claim_dispatch";
      payload: { owner: string; epoch: number; attempt_id: string };
    }) => Promise<unknown>;
    start: (input: { authority: ChatFenceAuthority; attemptId: string }) => Promise<T>;
  },
) {
  const authority = createChatFenceAuthority(input.authority);
  const command = chatFenceCommandSchema.parse({
    action: "claim_dispatch",
    payload: {
      owner: authority.owner,
      epoch: authority.epoch,
      attempt_id: input.attemptId,
    },
  });
  if (command.action !== "claim_dispatch") throw new Error("Invalid dispatch command");
  const attemptId = command.payload.attempt_id;
  let raw;
  try {
    raw = await adapters.claim(command);
  } catch {
    return { state: "ambiguous" as const, phase: "claim" as const, attemptId };
  }
  const parsed = parseChatFenceReceipt(authority.chatId, command, raw);
  if (!parsed.ok || parsed.action !== "claim_dispatch")
    return { state: "invalid_receipt" as const };
  const { claimed, attempt_id, receipt } = parsed.value;
  if (!claimed) return { state: "information_only" as const, attemptId: attempt_id, receipt };
  // Never return claimed:true as reusable permission. This invocation consumes it immediately.
  try {
    const value = await adapters.start({ authority, attemptId: attempt_id });
    return { state: "started" as const, attemptId: attempt_id, receipt, value };
  } catch {
    // Binding may already have happened. Do not promote, revoke, release or start again.
    return { state: "ambiguous" as const, phase: "start" as const, attemptId: attempt_id, receipt };
  }
}
