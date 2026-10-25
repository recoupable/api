import { executeChatFenceCommand } from "./executeChatFenceCommand";
import {
  verifyChatAdmissionSnapshot,
  type ChatAdmissionScope,
} from "@/lib/chat/fence/verifyChatAdmissionSnapshot";
import type { ChatFenceFailure } from "@/lib/chat/fence/classifyChatFenceError";
/** Retrieve the original only. This performs no dispatch, auth refresh or mutable-default lookup. */
export async function getChatAdmissionSnapshot(
  scope: ChatAdmissionScope,
): Promise<
  | { ok: true; state: "closed" | "open"; snapshot: ReturnType<typeof verifyChatAdmissionSnapshot> }
  | ChatFenceFailure
> {
  const result = await executeChatFenceCommand(scope.chatId, scope.effectiveAccountId, {
    action: "admission_snapshot",
    payload: { request_id: scope.requestId },
  });
  if (result.ok === false) return result;
  try {
    if (result.action !== "admission_snapshot") throw new Error("Unexpected action");
    const snapshot = verifyChatAdmissionSnapshot(scope, result.value);
    return { ok: true, state: snapshot.receipt.closed ? "closed" : "open", snapshot };
  } catch {
    return { ok: false, error: { kind: "invalid_receipt", retrySameCommand: false } };
  }
}
