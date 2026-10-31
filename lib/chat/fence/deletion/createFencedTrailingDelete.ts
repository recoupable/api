import { z } from "zod";
import type { executeChatFenceCommand } from "@/lib/supabase/chat_fence/executeChatFenceCommand";
import { type ChatFenceCommand } from "../chatFenceSchemas";
import { encodeStrictJson } from "../encodeStrictJson";
import { parseChatFenceReceipt } from "../parseChatFenceReceipt";
import { FencedPersistenceError } from "../persistence/FencedPersistenceError";

import { fencedTrailingDeleteIntentSchema as intentSchema } from "../chatFenceInputSchemas";
export { intentSchema as fencedTrailingDeleteIntentSchema };
export type FencedTrailingDeleteIntent = Readonly<z.infer<typeof intentSchema>>;

/**
 * Internal, unwired adapter. Caller must authorize the chat/effective account.
 * Capture original intent once; no state lookup, cancellation, retry or legacy fallback.
 */
export function createFencedTrailingDelete(
  input: FencedTrailingDeleteIntent,
  execute: typeof executeChatFenceCommand,
) {
  encodeStrictJson(input);
  const original = Object.freeze(intentSchema.parse(input));
  const command = Object.freeze({
    action: "delete" as const,
    payload: Object.freeze({
      request_id: original.requestId,
      expected_epoch: original.expectedEpoch,
      anchor_id: original.anchorId,
    }),
  }) satisfies ChatFenceCommand;
  return Object.freeze({
    async delete(): Promise<Readonly<{ request_id: string; epoch: number; deleted: number }>> {
      let result;
      try {
        result = await execute(original.chatId, original.effectiveAccount, command);
      } catch {
        throw new FencedPersistenceError("transport_ambiguous");
      }
      if (result?.ok === false)
        throw new FencedPersistenceError(result.error.kind, result.error.retrySameCommand);
      if (result?.ok !== true || result.action !== "delete")
        throw new FencedPersistenceError("invalid_receipt");
      const checked = parseChatFenceReceipt(original.chatId, command, result.value);
      if (checked.ok === false || checked.action !== "delete")
        throw new FencedPersistenceError("invalid_receipt");
      return Object.freeze(checked.value);
    },
  });
}
