import { createHash } from "node:crypto";
import { z } from "zod";
import { chatFenceReceiptSchemas } from "./chatFenceSchemas";
import { encodeStrictJson } from "./encodeStrictJson";
const scopeSchema = z
  .object({
    chatId: z.string().min(1),
    sessionId: z.string().min(1),
    effectiveAccountId: z.uuid(),
    requestId: z.uuid(),
    expectedEpoch: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  })
  .strict();
export type ChatAdmissionScope = z.infer<typeof scopeSchema>;
/** Integrity verification only. An open snapshot is NOT evidence of never-dispatched. */
export function verifyChatAdmissionSnapshot(originalScope: ChatAdmissionScope, input: unknown) {
  encodeStrictJson(input);
  const scope = scopeSchema.parse(originalScope);
  const stored = chatFenceReceiptSchemas.admission_snapshot.parse(input);
  const { receipt, admission_envelope: admission, execution_snapshot: execution } = stored;
  const hash = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");
  if (
    receipt.chat_id !== scope.chatId ||
    receipt.request_id !== scope.requestId ||
    receipt.expected_epoch !== scope.expectedEpoch ||
    receipt.epoch !== scope.expectedEpoch + 1 ||
    admission.chatId !== scope.chatId ||
    admission.sessionId !== scope.sessionId ||
    admission.effectiveAccountId !== scope.effectiveAccountId ||
    admission.expectedEpoch !== scope.expectedEpoch ||
    execution.chatId !== scope.chatId ||
    execution.sessionId !== scope.sessionId ||
    execution.effectiveAccountId !== scope.effectiveAccountId ||
    execution.requestId !== scope.requestId ||
    execution.id !== admission.executionSnapshot.id ||
    encodeStrictJson(admission) !== stored.admission_canonical ||
    encodeStrictJson(execution) !== stored.execution_canonical ||
    hash(stored.admission_canonical) !== receipt.input_hash ||
    hash(stored.execution_canonical) !== admission.executionSnapshot.digest ||
    encodeStrictJson(execution.content.options) !== encodeStrictJson(admission.options)
  ) {
    throw new Error("Inconsistent original admission snapshot");
  }
  return stored;
}
