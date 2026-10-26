import type { executeChatFenceCommand } from "@/lib/supabase/chat_fence/executeChatFenceCommand";
import { encodeStrictJson } from "../encodeStrictJson";
import { parseChatFenceReceipt } from "../parseChatFenceReceipt";
import { FencedPersistenceError } from "../persistence/FencedPersistenceError";
import { fencedEditScopeSchema, type FencedEditScope } from "./chatEditMaterialSchema";
import { verifyFencedEditMaterial } from "./verifyFencedEditMaterial";
import { readOriginalFencedEdit } from "./readOriginalFencedEdit";

/** Unwired exact-capture write/read adapter. Neither method admits, starts, retries or changes identity. */
export function createFencedAtomicEdit(
  inputScope: FencedEditScope,
  input: unknown,
  execute: typeof executeChatFenceCommand,
) {
  const scope = fencedEditScopeSchema.parse(JSON.parse(encodeStrictJson(inputScope)));
  const material = verifyFencedEditMaterial(scope, input);
  const { deletion } = material.capture;
  const commandBytes = encodeStrictJson({
    action: "delete_edit",
    payload: {
      request_id: scope.requestId,
      expected_epoch: deletion.expectedEpoch,
      anchor_id: deletion.anchorId,
      edit_material: material,
    },
  });
  const originalIntent = material.user_intent_canonical;
  return Object.freeze({
    async delete() {
      const command = JSON.parse(commandBytes);
      let result;
      try {
        result = await execute(scope.chatId, scope.effectiveAccount, JSON.parse(commandBytes));
      } catch {
        throw new FencedPersistenceError("transport_ambiguous");
      }
      if (result?.ok === false)
        throw new FencedPersistenceError(result.error.kind, result.error.retrySameCommand);
      if (result?.ok !== true || result.action !== "delete_edit")
        throw new FencedPersistenceError("invalid_receipt");
      const checked = parseChatFenceReceipt(
        scope.chatId,
        command,
        result.value,
        scope.effectiveAccount,
      );
      if (!checked.ok || checked.action !== "delete_edit")
        throw new FencedPersistenceError("invalid_receipt");
      return Object.freeze(checked.value);
    },
    async read() {
      const stored = await readOriginalFencedEdit(scope, execute);
      if (stored.edit_material.user_intent_canonical !== originalIntent)
        throw new FencedPersistenceError("invalid_command");
      return stored;
    },
  });
}
