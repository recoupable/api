import {
  chatFenceReceiptSchemas,
  type ChatFenceCommand,
  type ChatFenceSuccess,
} from "./chatFenceSchemas";
import type { ChatFenceFailure } from "./classifyChatFenceError";

/** Validate both wire shape and receipt identity; a closed receipt retains its original run. */
export function parseChatFenceReceipt(
  chatId: string,
  command: ChatFenceCommand,
  input: unknown,
): ChatFenceSuccess | ChatFenceFailure {
  const parsed = chatFenceReceiptSchemas[command.action].safeParse(input);
  const invalid: ChatFenceFailure = {
    ok: false,
    error: { kind: "invalid_receipt", retrySameCommand: false },
  };
  if (!parsed.success) return invalid;
  const value = parsed.data;
  if (command.action === "admission_snapshot") {
    const snapshot = chatFenceReceiptSchemas.admission_snapshot.parse(value);
    if (
      snapshot.receipt.chat_id !== chatId ||
      snapshot.receipt.request_id !== command.payload.request_id
    )
      return invalid;
  }
  if ("chat_id" in value && value.chat_id !== chatId) return invalid;
  if (command.action === "claim_dispatch") {
    const claim = chatFenceReceiptSchemas.claim_dispatch.parse(value);
    const receipt = claim.receipt;
    if (
      receipt.chat_id !== chatId ||
      receipt.request_id !== command.payload.owner ||
      receipt.epoch !== command.payload.epoch ||
      receipt.epoch !== receipt.expected_epoch + 1 ||
      (receipt.bound_run_id !== null && claim.attempt_id === null) ||
      (claim.claimed &&
        (claim.attempt_id !== command.payload.attempt_id ||
          receipt.closed ||
          receipt.bound_run_id !== null))
    )
      return invalid;
  }
  if (command.action === "admit") {
    const receipt = chatFenceReceiptSchemas.admit.parse(value);
    if (
      receipt.request_id !== command.payload.request_id ||
      receipt.expected_epoch !== command.payload.expected_epoch ||
      receipt.input_hash !== command.payload.input_hash ||
      receipt.epoch !== receipt.expected_epoch + 1
    )
      return invalid;
  }
  if (command.action === "delete") {
    const receipt = chatFenceReceiptSchemas.delete.parse(value);
    if (
      receipt.request_id !== command.payload.request_id ||
      receipt.epoch !== command.payload.expected_epoch + 1
    )
      return invalid;
  }
  if (
    command.action === "write" &&
    command.payload.mode === "insert" &&
    chatFenceReceiptSchemas.write.parse(value).outcome === "updated"
  )
    return invalid;
  // The indexed schema above establishes this action/value relationship at runtime.
  return { ok: true, action: command.action, value } as ChatFenceSuccess;
}
