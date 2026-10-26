import { beforeEach, expect, it, vi } from "vitest";
import { captureFencedEditedTurn } from "../captureFencedEditedTurn";
import { createFencedAtomicEdit } from "../createFencedAtomicEdit";
import { readOriginalFencedEdit } from "../readOriginalFencedEdit";
import { executeChatFenceCommand } from "@/lib/supabase/chat_fence/executeChatFenceCommand";
import { encodeStrictJson } from "../../encodeStrictJson";
import { editFixture } from "./editFixture";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/serverClient", () => ({ default: { rpc } }));
function fixture(input = editFixture()) {
  const scope = {
    chatId: input.deletion.chatId,
    effectiveAccount: input.deletion.effectiveAccount,
    sessionId: input.workflowInput.sessionId,
    requestId: input.deletion.requestId,
  };
  const material = {
    capture: captureFencedEditedTurn(input).read(),
    user_intent_canonical: encodeStrictJson({
      anchor_id: input.deletion.anchorId,
      edited_user_message: input.editedUserMessage,
      requested_options: {},
    }),
    history_witness: input.workflowInput.messages.map(message => ({
      id: message.id,
      role: message.role,
      message,
    })),
  };
  const receipt = { request_id: scope.requestId, epoch: 2, deleted: 2 };
  return { scope, material, receipt };
}
beforeEach(() => vi.resetAllMocks());
it("captures an immutable atomic edit command and only explicitly reconciles the original key", async () => {
  const { scope, material, receipt } = fixture();
  const original = structuredClone(material);
  const edit = createFencedAtomicEdit(scope, material, executeChatFenceCommand);
  expect(rpc).not.toHaveBeenCalled();
  material.capture.admission.payload.expected_epoch = 8;
  scope.requestId = "77777777-7777-4777-8777-777777777777";
  rpc.mockResolvedValue({ data: receipt, error: null });
  expect(await edit.delete()).toEqual(receipt);
  expect(rpc.mock.calls[0][1].p).toEqual({
    request_id: receipt.request_id,
    expected_epoch: 1,
    anchor_id: "old-user",
    edit_material: original,
  });
  await edit.delete();
  expect(rpc.mock.calls[1]).toEqual(rpc.mock.calls[0]);
  rpc.mockResolvedValue({ data: { receipt, edit_material: original }, error: null });
  const saved = await edit.read();
  expect(saved.edit_material).toEqual(original);
  expect(rpc.mock.calls.map(([, args]) => args.p_action)).toEqual([
    "delete_edit",
    "delete_edit",
    "deletion_snapshot",
  ]);
  expect(rpc.mock.calls[2][1].p).toEqual({ request_id: receipt.request_id });
});
it.each(["lost", "wrong-request", "wrong-epoch", "unknown", "sql"])(
  "fails closed on %s without automatic read or retry",
  async mode => {
    const { scope, material, receipt } = fixture();
    const edit = createFencedAtomicEdit(scope, material, executeChatFenceCommand);
    rpc.mockImplementation(async () => {
      if (mode === "lost") throw new Error("lost acknowledgement");
      if (mode === "sql") return { data: null, error: { code: "22023" } };
      return {
        data:
          mode === "unknown"
            ? { success: true }
            : {
                ...receipt,
                ...(mode === "wrong-epoch" ? { epoch: 3 } : {}),
                ...(mode === "wrong-request"
                  ? { request_id: "77777777-7777-4777-8777-777777777777" }
                  : {}),
              },
        error: null,
      };
    });
    await expect(edit.delete()).rejects.toThrow();
    expect(rpc).toHaveBeenCalledTimes(1);
  },
);
it.each(["intent", "witness", "scope", "canonical", "extra", "epoch"])(
  "rejects %s binding before any RPC",
  mode => {
    const { scope, material } = fixture();
    if (mode === "intent")
      material.user_intent_canonical = material.user_intent_canonical.replace(
        'edited"',
        'different"',
      );
    if (mode === "witness") material.history_witness[0].message.parts[0].text = "different";
    if (mode === "scope") scope.sessionId = "foreign";
    if (mode === "canonical") material.capture.admission.payload.execution_canonical += " ";
    if (mode === "extra") Object.assign(material, { credentials: "forbidden" });
    if (mode === "epoch")
      material.capture.deletion = { ...material.capture.deletion, expectedEpoch: 2 };
    expect(() => createFencedAtomicEdit(scope, material, executeChatFenceCommand)).toThrow();
    expect(rpc).not.toHaveBeenCalled();
  },
);
it("recovers only original material with current caller-supplied authorized scope", async () => {
  const { scope, material, receipt } = fixture();
  rpc.mockResolvedValue({ data: { receipt, edit_material: material }, error: null });
  expect(await readOriginalFencedEdit(scope, executeChatFenceCommand)).toEqual({
    receipt,
    edit_material: material,
  });
  expect(rpc.mock.calls[0][1].p).toEqual({ request_id: scope.requestId });
  rpc.mockResolvedValue({ data: { receipt, edit_material: null }, error: null });
  await expect(readOriginalFencedEdit(scope, executeChatFenceCommand)).rejects.toThrow();
});
it.each([
  "outer-key",
  "outer-anchor",
  "outer-epoch",
  "account",
  "hash",
  "witness-role",
  "options",
  "canonical-intent",
])("RPC boundary rejects %s bypass before transport", async mode => {
  const { scope, material } = fixture();
  const command = {
    action: "delete_edit",
    payload: {
      request_id: scope.requestId,
      expected_epoch: 1,
      anchor_id: "old-user",
      edit_material: material,
    },
  };
  if (mode === "outer-key") Object.assign(command.payload, { owner: "not-allowed" });
  if (mode === "outer-anchor") command.payload.anchor_id = "other";
  if (mode === "outer-epoch") command.payload.expected_epoch = 2;
  if (mode === "account") scope.effectiveAccount = "77777777-7777-4777-8777-777777777777";
  if (mode === "hash") material.capture.admission.payload.input_hash = "a".repeat(64);
  if (mode === "witness-role") material.history_witness[0].role = "assistant";
  if (mode === "options")
    material.user_intent_canonical = encodeStrictJson({
      ...JSON.parse(material.user_intent_canonical),
      requested_options: { modelId: "different" },
    });
  if (mode === "canonical-intent") material.user_intent_canonical += " ";
  expect(
    await executeChatFenceCommand(scope.chatId, scope.effectiveAccount, command),
  ).toMatchObject({ ok: false, error: { kind: "invalid_command" } });
  expect(rpc).not.toHaveBeenCalled();
});
it.each([
  "unknown-key",
  "wrong-request",
  "wrong-account",
  "wrong-session",
  "changed-intent",
  "canonical",
  "lost",
  "missing",
])("original read rejects %s without follow-up effects", async mode => {
  const { scope, material, receipt } = fixture();
  const edit = createFencedAtomicEdit(scope, material, executeChatFenceCommand);
  const saved = { receipt, edit_material: material };
  if (mode === "unknown-key") Object.assign(saved, { success: true });
  if (mode === "wrong-request") receipt.request_id = "77777777-7777-4777-8777-777777777777";
  if (mode === "wrong-account")
    material.capture.deletion = {
      ...material.capture.deletion,
      effectiveAccount: "77777777-7777-4777-8777-777777777777",
    };
  if (mode === "wrong-session") scope.sessionId = "foreign";
  if (mode === "changed-intent")
    material.user_intent_canonical = material.user_intent_canonical.replace(
      'edited"',
      'different"',
    );
  if (mode === "canonical") material.capture.admission.payload.admission_canonical += " ";
  rpc.mockImplementation(async () => {
    if (mode === "lost") throw new Error("lost read");
    if (mode === "missing") return { data: null, error: { code: "P0002" } };
    return { data: saved, error: null };
  });
  if (mode === "wrong-session")
    await expect(readOriginalFencedEdit(scope, executeChatFenceCommand)).rejects.toThrow();
  else await expect(edit.read()).rejects.toThrow();
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(rpc.mock.calls[0][1].p_action).toBe("deletion_snapshot");
});
it("explicitly reads a same-intent winning capture without writing loser IDs", async () => {
  const { scope, material, receipt } = fixture();
  const edit = createFencedAtomicEdit(scope, material, executeChatFenceCommand);
  const winnerInput = editFixture();
  winnerInput.replacementUserId = "winner-user";
  winnerInput.admissionRequestId = "77777777-7777-4777-8777-777777777777";
  winnerInput.snapshotId = "winner-snapshot";
  const winner = { ...material, capture: captureFencedEditedTurn(winnerInput).read() };
  rpc.mockResolvedValueOnce({ data: null, error: { code: "22023" } });
  await expect(edit.delete()).rejects.toThrow();
  expect(rpc).toHaveBeenCalledTimes(1);
  rpc.mockResolvedValueOnce({ data: { receipt, edit_material: winner }, error: null });
  const found = await edit.read();
  expect(found.edit_material).toEqual(winner);
  expect(rpc.mock.calls.map(([, args]) => args.p_action)).toEqual([
    "delete_edit",
    "deletion_snapshot",
  ]);
});
it("preserves omitted requested options versus explicit null and never refreshes defaults", () => {
  const { scope, material } = fixture();
  const intent = JSON.parse(material.user_intent_canonical);
  expect(intent.requested_options).toEqual({});
  material.user_intent_canonical = encodeStrictJson({
    ...intent,
    requested_options: { artistId: null },
  });
  expect(() => createFencedAtomicEdit(scope, material, executeChatFenceCommand)).not.toThrow();
  material.user_intent_canonical = encodeStrictJson({
    ...intent,
    requested_options: { interactive: null },
  });
  expect(() => createFencedAtomicEdit(scope, material, executeChatFenceCommand)).toThrow();
  expect(rpc).not.toHaveBeenCalled();
});
it.each(["messages", "parts", "id-bytes", "canonical-bytes", "material-bytes", "depth"])(
  "rejects new edit %s limit before effects",
  mode => {
    const { scope, material } = fixture();
    if (mode === "messages")
      material.history_witness = Array.from({ length: 1001 }, () => material.history_witness[0]);
    if (mode === "parts")
      material.history_witness[0].message.parts = Array.from({ length: 10001 }, () => ({
        type: "text",
        text: "x",
      }));
    if (mode === "id-bytes") material.history_witness[0].id = "é".repeat(257);
    if (mode === "canonical-bytes") material.user_intent_canonical = " ".repeat(1024 * 1024 + 1);
    if (mode === "material-bytes") Object.assign(material, { extra: "x".repeat(8 * 1024 * 1024) });
    if (mode === "depth") {
      let nested: unknown = null;
      for (let n = 0; n < 102; n++) nested = { nested };
      Object.assign(material.history_witness[0].message, { metadata: nested });
    }
    expect(() => createFencedAtomicEdit(scope, material, executeChatFenceCommand)).toThrow();
    expect(rpc).not.toHaveBeenCalled();
  },
);
it("accepts legacy deletion snapshot null at RPC shape boundary but never as edited recovery", async () => {
  const { scope, receipt } = fixture();
  rpc.mockResolvedValue({ data: { receipt, edit_material: null }, error: null });
  expect(
    await executeChatFenceCommand(scope.chatId, scope.effectiveAccount, {
      action: "deletion_snapshot",
      payload: { request_id: scope.requestId },
    }),
  ).toEqual({ ok: true, action: "deletion_snapshot", value: { receipt, edit_material: null } });
});
it("rejects missing normalized options rather than silently defaulting command or snapshot", async () => {
  const { scope, material, receipt } = fixture();
  Reflect.deleteProperty(
    material.capture.admission.payload.admission_envelope.options,
    "interactive",
  );
  expect(() => createFencedAtomicEdit(scope, material, executeChatFenceCommand)).toThrow();
  const command = {
    action: "delete_edit",
    payload: {
      request_id: scope.requestId,
      expected_epoch: 1,
      anchor_id: "old-user",
      edit_material: material,
    },
  };
  expect(
    await executeChatFenceCommand(scope.chatId, scope.effectiveAccount, command),
  ).toMatchObject({ ok: false, error: { kind: "invalid_command" } });
  expect(rpc).not.toHaveBeenCalled();
  rpc.mockResolvedValue({ data: { receipt, edit_material: material }, error: null });
  expect(
    await executeChatFenceCommand(scope.chatId, scope.effectiveAccount, {
      action: "deletion_snapshot",
      payload: { request_id: scope.requestId },
    }),
  ).toMatchObject({ ok: false, error: { kind: "invalid_receipt" } });
});
it("does not invoke accessors in candidate material", () => {
  const { scope, material } = fixture();
  const getter = vi.fn();
  Object.defineProperty(material, "user_intent_canonical", { get: getter, enumerable: true });
  expect(() => createFencedAtomicEdit(scope, material, executeChatFenceCommand)).toThrow();
  expect(getter).not.toHaveBeenCalled();
  expect(rpc).not.toHaveBeenCalled();
});
it.each(["history", "parts"])(
  "rejects oversized %s before enumerating its contents at every boundary",
  async mode => {
    const { scope, material, receipt } = fixture();
    const enumerate = vi.fn();
    if (mode === "history")
      material.history_witness = new Proxy(
        Array.from({ length: 1001 }, () => material.history_witness[0]),
        {
          ownKeys: target => {
            enumerate();
            return Reflect.ownKeys(target);
          },
        },
      );
    else
      material.history_witness[0].message.parts = new Proxy(
        Array.from({ length: 10001 }, () => ({ type: "text", text: "x" })),
        {
          ownKeys: target => {
            enumerate();
            return Reflect.ownKeys(target);
          },
        },
      );
    expect(() => createFencedAtomicEdit(scope, material, executeChatFenceCommand)).toThrow(/limit/);
    const command = {
      action: "delete_edit",
      payload: {
        request_id: scope.requestId,
        expected_epoch: 1,
        anchor_id: "old-user",
        edit_material: material,
      },
    };
    expect(
      await executeChatFenceCommand(scope.chatId, scope.effectiveAccount, command),
    ).toMatchObject({ ok: false, error: { kind: "invalid_command" } });
    expect(rpc).not.toHaveBeenCalled();
    rpc.mockResolvedValue({ data: { receipt, edit_material: material }, error: null });
    await expect(readOriginalFencedEdit(scope, executeChatFenceCommand)).rejects.toThrow();
    expect(enumerate).not.toHaveBeenCalled();
  },
);
it("byte budgets count exact UTF-8 punctuation/escaping without altering canonical bytes", () => {
  for (const value of [null, true, 42, "é", "\n", ["é", false], { é: "\n", empty: [] }, {}]) {
    const bytes = encodeStrictJson(value);
    const size = Buffer.byteLength(bytes, "utf8");
    expect(encodeStrictJson(value, { maxBytes: size })).toBe(bytes);
    expect(() => encodeStrictJson(value, { maxBytes: size - 1 })).toThrow(/budget/);
  }
});
it("accepts exact new-edit message, parts, UTF-8 ID and witness byte caps", () => {
  const messageInput = editFixture();
  messageInput.workflowInput.messages = Array.from({ length: 1000 }, (_, i) => ({
    id: i === 999 ? "old-user" : `prefix-${i}`,
    role: "user" as const,
    parts: [{ type: "text" as const, text: "source" }],
  }));
  const atMessages = fixture(messageInput);
  expect(() =>
    createFencedAtomicEdit(atMessages.scope, atMessages.material, executeChatFenceCommand),
  ).not.toThrow();
  const partsInput = editFixture();
  partsInput.workflowInput.messages[2].parts = Array.from({ length: 9996 }, () => ({
    type: "text" as const,
    text: "x",
  }));
  const atParts = fixture(partsInput);
  expect(() =>
    createFencedAtomicEdit(atParts.scope, atParts.material, executeChatFenceCommand),
  ).not.toThrow();
  const idInput = editFixture();
  idInput.replacementUserId = "é".repeat(256);
  const atId = fixture(idInput);
  expect(() =>
    createFencedAtomicEdit(atId.scope, atId.material, executeChatFenceCommand),
  ).not.toThrow();
  const atWitness = fixture();
  const witnessPart = atWitness.material.history_witness[2].message.parts[0];
  witnessPart.text = "";
  const overhead = Buffer.byteLength(encodeStrictJson(atWitness.material.history_witness), "utf8");
  witnessPart.text = "x".repeat(4 * 1024 * 1024 - overhead);
  expect(() =>
    createFencedAtomicEdit(atWitness.scope, atWitness.material, executeChatFenceCommand),
  ).not.toThrow();
  witnessPart.text += "x";
  expect(() =>
    createFencedAtomicEdit(atWitness.scope, atWitness.material, executeChatFenceCommand),
  ).toThrow(/budget/);
  expect(rpc).not.toHaveBeenCalled();
});
