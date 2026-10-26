import type { UIMessage } from "ai";
import { z } from "zod";
import type { RunAgentWorkflowInput } from "@/app/lib/workflows/runAgentWorkflow";
import type { executeChatFenceCommand } from "@/lib/supabase/chat_fence/executeChatFenceCommand";
import {
  createFencedTrailingDelete,
  type FencedTrailingDeleteIntent,
} from "../deletion/createFencedTrailingDelete";
import { buildChatExecutionSnapshot } from "../buildChatExecutionSnapshot";
import { canonicalizeChatAdmission } from "../canonicalizeChatAdmission";
import { chatAdmissionSchema } from "../chatAdmissionSchema";
import { chatFenceCommandSchema, type ChatFenceCommand } from "../chatFenceSchemas";
import { encodeStrictJson } from "../encodeStrictJson";
import { FencedPersistenceError } from "../persistence/FencedPersistenceError";

type EditedTurnInput = {
  deletion: FencedTrailingDeleteIntent;
  workflowInput: RunAgentWorkflowInput;
  editedUserMessage: UIMessage;
  replacementUserId: string;
  admissionRequestId: string;
  snapshotId: string;
  tombstonedMessageIds: readonly string[];
  credentialPolicy: unknown;
};
type PreparedEditedTurn = {
  turn: { kind: "new" };
  admission: Extract<ChatFenceCommand, { action: "admit" }>;
  deletionReceipt: Readonly<{ request_id: string; epoch: number; deleted: number }>;
};
/**
 * Internal preparation only. Caller supplies authorized original scope, complete
 * history and known tombstones, and IDs allocated once before retry. SQL remains
 * authoritative for unseen collisions. No admission, dispatch or credential effects.
 */
export function createFencedEditedTurn(
  input: EditedTurnInput,
  execute: typeof executeChatFenceCommand,
) {
  // Retain only strict JSON edit material, not the credential-bearing workflow object.
  const captured = JSON.parse(
    encodeStrictJson({
      deletion: input.deletion,
      messages: input.workflowInput.messages,
      editedUserMessage: input.editedUserMessage,
      replacementUserId: input.replacementUserId,
      admissionRequestId: input.admissionRequestId,
      snapshotId: input.snapshotId,
      tombstonedMessageIds: input.tombstonedMessageIds,
    }),
  ) as Omit<EditedTurnInput, "workflowInput" | "credentialPolicy"> & { messages: UIMessage[] };
  const deletion = createFencedTrailingDelete(captured.deletion, execute);
  const { chatId, effectiveAccount, expectedEpoch, anchorId, requestId } = captured.deletion;
  // Reserve capacity for deletion AND the subsequent admission, before either mutation.
  if (expectedEpoch > Number.MAX_SAFE_INTEGER - 2 || captured.admissionRequestId === requestId)
    throw new Error("Invalid edited-turn identity or epoch capacity");
  const history = chatAdmissionSchema.shape.messages.parse(captured.messages);
  const ids = history.map(message => message.id);
  const anchor = history.findIndex(message => message.id === anchorId);
  if (
    new Set(ids).size !== ids.length ||
    anchor < 0 ||
    history[anchor].role !== "user" ||
    captured.editedUserMessage.id !== anchorId ||
    captured.editedUserMessage.role !== "user"
  )
    throw new Error("Edited turn requires one original user anchor");
  const unavailable = new Set([
    ...ids,
    ...z.array(z.string().min(1)).parse(captured.tombstonedMessageIds),
  ]);
  if (unavailable.has(captured.replacementUserId))
    throw new Error("Replacement identity is unavailable");
  const execution = buildChatExecutionSnapshot({
    id: captured.snapshotId,
    requestId: captured.admissionRequestId,
    workflowInput: input.workflowInput,
    credentialPolicy: input.credentialPolicy,
  });
  if (
    execution.snapshot.chatId !== chatId ||
    execution.snapshot.effectiveAccountId !== effectiveAccount
  )
    throw new Error("Edited-turn scope mismatch");
  const messages = [
    ...history.slice(0, anchor),
    { ...captured.editedUserMessage, id: captured.replacementUserId },
  ];
  // Preflight all canonical material before deletion. Receipt must confirm this exact epoch.
  const admission = canonicalizeChatAdmission({
    contractVersion: "chat-admission/v1",
    effectiveAccountId: effectiveAccount,
    chatId,
    sessionId: execution.snapshot.sessionId,
    expectedEpoch: expectedEpoch + 1,
    messages,
    options: execution.snapshot.content.options,
    executionSnapshot: { id: execution.snapshot.id, digest: execution.digest },
  });
  const command = chatFenceCommandSchema.parse({
    action: "admit",
    payload: {
      request_id: captured.admissionRequestId,
      expected_epoch: admission.envelope.expectedEpoch,
      input_hash: admission.inputHash,
      admission_envelope: admission.envelope,
      execution_snapshot: execution.snapshot,
      admission_canonical: admission.canonical,
      execution_canonical: execution.canonical,
    },
  });
  const preparedBytes = encodeStrictJson({ turn: { kind: "new" }, admission: command });
  return Object.freeze({
    async prepare(): Promise<PreparedEditedTurn> {
      const receipt = await deletion.delete();
      if (receipt.epoch !== admission.envelope.expectedEpoch)
        throw new FencedPersistenceError("invalid_receipt");
      // Independent copies preserve replay bytes even if a consumer mutates its result.
      return { ...JSON.parse(preparedBytes), deletionReceipt: receipt };
    },
  });
}
