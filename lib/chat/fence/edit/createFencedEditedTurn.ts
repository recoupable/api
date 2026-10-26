import type { executeChatFenceCommand } from "@/lib/supabase/chat_fence/executeChatFenceCommand";
import { createFencedTrailingDelete } from "../deletion/createFencedTrailingDelete";
import { FencedPersistenceError } from "../persistence/FencedPersistenceError";
import { captureFencedEditedTurn, type EditedTurnInput } from "./captureFencedEditedTurn";

/**
 * Internal preparation only. Caller supplies authorized original scope, complete
 * history and known tombstones, and IDs allocated once before retry. SQL remains
 * authoritative for unseen collisions. No admission, dispatch or credential effects.
 */
export function createFencedEditedTurn(
  input: EditedTurnInput,
  execute: typeof executeChatFenceCommand,
) {
  const capture = captureFencedEditedTurn(input);
  const original = capture.read();
  const deletion = createFencedTrailingDelete(original.deletion, execute);
  const expectedEpoch = original.admission.payload.expected_epoch;
  return Object.freeze({
    async prepare() {
      const receipt = await deletion.delete();
      if (receipt.epoch !== expectedEpoch) throw new FencedPersistenceError("invalid_receipt");
      const { turn, admission } = capture.read();
      return { admission, turn, deletionReceipt: receipt };
    },
  });
}
