import { preflightFencedEditMaterial } from "./preflightFencedEditMaterial";
import { encodeStrictJson } from "../encodeStrictJson";
import { verifyChatAdmissionSnapshot } from "../verifyChatAdmissionSnapshot";
import {
  chatEditMaterialSchema,
  fencedEditScopeSchema,
  fencedEditUserIntentSchema,
  type FencedEditScope,
} from "./chatEditMaterialSchema";

/** Integrity only: caller supplies currently authorized scope and DB-ordered source history. */
export function verifyFencedEditMaterial(originalScope: FencedEditScope, input: unknown) {
  preflightFencedEditMaterial(input);
  const bytes = encodeStrictJson(input);
  if (Buffer.byteLength(bytes, "utf8") > 8 * 1024 * 1024)
    throw new Error("Edit material exceeds byte limit");
  const scope = fencedEditScopeSchema.parse(originalScope);
  const material = chatEditMaterialSchema.parse(JSON.parse(bytes));
  if (encodeStrictJson(material) !== bytes)
    throw new Error("Edit material must already be normalized");
  const { deletion, admission } = material.capture;
  const p = admission.payload;
  const witness = material.history_witness;
  if (Buffer.byteLength(encodeStrictJson(witness), "utf8") > 4 * 1024 * 1024)
    throw new Error("History witness exceeds byte limit");
  const intent = fencedEditUserIntentSchema.parse(JSON.parse(material.user_intent_canonical));
  const ids = witness.map(row => row.id);
  const anchor = ids.indexOf(deletion.anchorId);
  const replacement = p.admission_envelope.messages.at(-1);
  const same = (a: unknown, b: unknown) => encodeStrictJson(a) === encodeStrictJson(b);
  const idBytes = [
    scope.chatId,
    p.execution_snapshot.id,
    p.execution_snapshot.sessionId,
    p.admission_envelope.executionSnapshot.id,
  ];
  if (
    idBytes.some(id => Buffer.byteLength(id, "utf8") > 512) ||
    deletion.chatId !== scope.chatId ||
    deletion.effectiveAccount !== scope.effectiveAccount ||
    deletion.requestId !== scope.requestId ||
    deletion.requestId === p.request_id ||
    p.expected_epoch !== deletion.expectedEpoch + 1 ||
    !same(intent, JSON.parse(material.user_intent_canonical)) ||
    encodeStrictJson(intent) !== material.user_intent_canonical ||
    intent.anchor_id !== deletion.anchorId ||
    intent.edited_user_message.id !== deletion.anchorId ||
    new Set(ids).size !== ids.length ||
    anchor < 0 ||
    witness[anchor].role !== "user" ||
    witness.some(row => row.id !== row.message.id || row.role !== row.message.role) ||
    !replacement ||
    replacement.role !== "user" ||
    ids.includes(replacement.id) ||
    !same(replacement, { ...intent.edited_user_message, id: replacement.id }) ||
    !same(p.admission_envelope.messages, [
      ...witness.slice(0, anchor).map(row => row.message),
      replacement,
    ]) ||
    Object.entries(intent.requested_options).some(
      ([key, value]) =>
        !same(
          value,
          p.admission_envelope.options[key as keyof typeof p.admission_envelope.options],
        ),
    ) ||
    witness.reduce(
      (count, row) => count + row.message.parts.length,
      intent.edited_user_message.parts.length,
    ) > 10000
  )
    throw new Error("Inconsistent original edited-turn material");
  verifyChatAdmissionSnapshot(
    {
      chatId: scope.chatId,
      effectiveAccountId: scope.effectiveAccount,
      sessionId: scope.sessionId,
      requestId: p.request_id,
      expectedEpoch: p.expected_epoch,
    },
    {
      dispatch: { status: "never_attempted", attempt_id: null },
      admission_envelope: p.admission_envelope,
      execution_snapshot: p.execution_snapshot,
      admission_canonical: p.admission_canonical,
      execution_canonical: p.execution_canonical,
      receipt: {
        chat_id: scope.chatId,
        request_id: p.request_id,
        expected_epoch: p.expected_epoch,
        input_hash: p.input_hash,
        epoch: p.expected_epoch + 1,
        bound_run_id: null,
        closed: false,
      },
    },
  );
  return material;
}
