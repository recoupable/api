import { expect, it, vi } from "vitest";
import { captureFencedEditedTurn } from "../captureFencedEditedTurn";
import { createFencedEditedTurn } from "../createFencedEditedTurn";
import { editFixture } from "./editFixture";

it("exposes complete pre-delete material without any executor and isolates input/output mutations", async () => {
  const input = editFixture();
  Object.assign(input.workflowInput.agentContext, { recoupAccessToken: "synthetic-secret" });
  const capture = captureFencedEditedTurn(input);
  const first = capture.read();
  const bytes = JSON.stringify(first);
  expect(Object.isFrozen(capture)).toBe(true);
  expect(Object.keys(capture)).toEqual(["read"]);
  expect(first.deletion).toEqual(input.deletion);
  expect(first.turn).toEqual({ kind: "new" });
  expect(first.admission.payload.expected_epoch).toBe(2);
  expect(bytes).not.toContain("synthetic-secret");
  expect(first).not.toHaveProperty("deletionReceipt");
  input.deletion.expectedEpoch = 99;
  input.workflowInput.messages[0].parts[0].text = "changed input";
  input.editedUserMessage.parts[0].text = "changed edit";
  input.credentialPolicy.authorization.version = "changed policy";
  first.admission.payload.admission_envelope.messages[0].parts[0].text = "changed output";
  Object.assign(first.deletion, { expectedEpoch: 77 });
  expect(JSON.stringify(capture.read())).toBe(bytes);
  const execute = vi.fn().mockResolvedValue({
    ok: true,
    action: "delete",
    value: { request_id: editFixture().deletion.requestId, epoch: 2, deleted: 2 },
  });
  const legacy = createFencedEditedTurn(editFixture(), execute);
  expect(execute).not.toHaveBeenCalled();
  const prepared = await legacy.prepare();
  const material = capture.read();
  expect(material.turn).toEqual(prepared.turn);
  expect(material.admission).toEqual(prepared.admission);
});

it.each([
  "extra-intent-field",
  "invalid-account",
  "invalid-request",
  "negative-epoch",
  "fractional-epoch",
  "exhausted-epoch",
  "duplicate-history",
  "missing-anchor",
  "wrong-edit-role",
  "known-collision",
  "same-request",
  "scope",
  "policy-scope",
  "non-json",
])("pure capture rejects %s without an effect boundary", mode => {
  const input = editFixture();
  if (mode === "extra-intent-field") Object.assign(input.deletion, { owner: "untrusted" });
  if (mode === "invalid-account") input.deletion.effectiveAccount = "invalid";
  if (mode === "invalid-request") input.deletion.requestId = "invalid";
  if (mode === "negative-epoch") input.deletion.expectedEpoch = -1;
  if (mode === "fractional-epoch") input.deletion.expectedEpoch = 1.5;
  if (mode === "exhausted-epoch") input.deletion.expectedEpoch = Number.MAX_SAFE_INTEGER - 1;
  if (mode === "duplicate-history")
    input.workflowInput.messages.push(input.workflowInput.messages[0]);
  if (mode === "missing-anchor") input.deletion.anchorId = "missing";
  if (mode === "wrong-edit-role") Object.assign(input.editedUserMessage, { role: "assistant" });
  if (mode === "known-collision") input.replacementUserId = "earlier-tombstone";
  if (mode === "same-request") input.admissionRequestId = input.deletion.requestId;
  if (mode === "scope") input.workflowInput.chatId = "other";
  if (mode === "policy-scope")
    input.credentialPolicy.effectiveAccountId = "77777777-7777-4777-8777-777777777777";
  if (mode === "non-json")
    Object.assign(input.editedUserMessage, { metadata: { invalid: undefined } });
  expect(() => captureFencedEditedTurn(input)).toThrow();
});
