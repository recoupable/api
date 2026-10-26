import type { executeChatFenceCommand } from "@/lib/supabase/chat_fence/executeChatFenceCommand";
import { encodeStrictJson } from "../encodeStrictJson";
import { parseChatFenceReceipt } from "../parseChatFenceReceipt";
import { FencedPersistenceError } from "../persistence/FencedPersistenceError";
import { fencedEditScopeSchema, type FencedEditScope } from "./chatEditMaterialSchema";
import { verifyFencedEditMaterial } from "./verifyFencedEditMaterial";

/** Explicit original-key reconciliation only. Caller must reauthorize current account/session access. */
export async function readOriginalFencedEdit(
  input: FencedEditScope,
  execute: typeof executeChatFenceCommand,
) {
  const scope = fencedEditScopeSchema.parse(JSON.parse(encodeStrictJson(input)));
  const command = {
    action: "deletion_snapshot" as const,
    payload: { request_id: scope.requestId },
  };
  let result;
  try {
    result = await execute(scope.chatId, scope.effectiveAccount, command);
  } catch {
    throw new FencedPersistenceError("transport_ambiguous");
  }
  if (result?.ok === false)
    throw new FencedPersistenceError(result.error.kind, result.error.retrySameCommand);
  if (result?.ok !== true || result.action !== "deletion_snapshot")
    throw new FencedPersistenceError("invalid_receipt");
  const checked = parseChatFenceReceipt(
    scope.chatId,
    command,
    result.value,
    scope.effectiveAccount,
  );
  if (!checked.ok || checked.action !== "deletion_snapshot" || checked.value.edit_material === null)
    throw new FencedPersistenceError("invalid_receipt");
  try {
    const material = verifyFencedEditMaterial(scope, checked.value.edit_material);
    if (checked.value.receipt.epoch !== material.capture.deletion.expectedEpoch + 1)
      throw new Error("Wrong epoch");
    return { receipt: checked.value.receipt, edit_material: material };
  } catch {
    throw new FencedPersistenceError("invalid_receipt");
  }
}
