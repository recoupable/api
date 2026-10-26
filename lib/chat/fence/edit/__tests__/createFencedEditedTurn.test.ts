import { beforeEach, expect, it, vi } from "vitest";
import { createFencedEditedTurn } from "../createFencedEditedTurn";
import { executeChatFenceCommand } from "@/lib/supabase/chat_fence/executeChatFenceCommand";
import { editFixture } from "./editFixture";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/serverClient", () => ({ default: { rpc } }));
beforeEach(() => {
  vi.resetAllMocks();
  rpc.mockResolvedValue({
    data: { request_id: editFixture().deletion.requestId, epoch: 2, deleted: 2 },
    error: null,
  });
});
it("captures one immutable edit and returns only a prepared new-turn admission after original delete acknowledgement", async () => {
  const input = editFixture();
  const edit = createFencedEditedTurn(input, executeChatFenceCommand);
  expect(rpc).not.toHaveBeenCalled();
  input.editedUserMessage.parts[0].text = "mutated";
  input.workflowInput.messages[0].parts[0].text = "mutated";
  input.replacementUserId = "mutated";
  input.deletion.expectedEpoch = 8;
  input.credentialPolicy.authorization.version = "mutated";
  const first = await edit.prepare();
  expect(first.turn).toEqual({ kind: "new" });
  expect(first.admission.payload.expected_epoch).toBe(2);
  expect(first.admission.payload.admission_envelope.messages.map(m => m.id)).toEqual([
    "prefix-user",
    "prefix-assistant",
    "fresh-edited-user",
  ]);
  expect(first.admission.payload.admission_envelope.messages.at(-1)?.parts[0]).toEqual({
    type: "text",
    text: "edited",
  });
  const original = JSON.stringify(first);
  first.admission.payload.admission_envelope.messages[0].parts[0].text = "caller changed output";
  const replay = await edit.prepare();
  expect(JSON.stringify(replay)).toBe(original);
  expect(rpc.mock.calls.map(([, args]) => args.p_action)).toEqual(["delete", "delete"]);
  expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]);
});
it.each(["old-user", "old-assistant", "prefix-user", "prefix-assistant", "earlier-tombstone"])(
  "rejects captured unavailable replacement ID %s before any command",
  id => {
    const input = editFixture();
    input.replacementUserId = id;
    expect(() => createFencedEditedTurn(input, executeChatFenceCommand)).toThrow();
    expect(rpc).not.toHaveBeenCalled();
  },
);
it.each([
  "missing-anchor",
  "duplicate-history",
  "assistant-anchor",
  "wrong-edit-id",
  "same-request",
  "scope",
  "policy-scope",
  "epoch-capacity",
  "invalid-content",
])("preflights %s before destructive work", mode => {
  const input = editFixture();
  if (mode === "missing-anchor") input.deletion.anchorId = "missing";
  if (mode === "duplicate-history")
    input.workflowInput.messages.push(input.workflowInput.messages[0]);
  if (mode === "assistant-anchor") input.deletion.anchorId = "old-assistant";
  if (mode === "wrong-edit-id") input.editedUserMessage.id = "wrong";
  if (mode === "same-request") input.admissionRequestId = input.deletion.requestId;
  if (mode === "scope") input.workflowInput.chatId = "foreign";
  if (mode === "policy-scope")
    input.credentialPolicy.effectiveAccountId = "77777777-7777-4777-8777-777777777777";
  if (mode === "epoch-capacity") input.deletion.expectedEpoch = Number.MAX_SAFE_INTEGER - 1;
  if (mode === "invalid-content") input.editedUserMessage.parts[0].text = "\u0000";
  expect(() => createFencedEditedTurn(input, executeChatFenceCommand)).toThrow();
  expect(rpc).not.toHaveBeenCalled();
});
it.each(["lost", "epoch", "request", "false", "sql"])(
  "does not prepare/admit/dispatch after %s acknowledgement",
  async mode => {
    const edit = createFencedEditedTurn(editFixture(), executeChatFenceCommand);
    rpc.mockImplementation(async () => {
      if (mode === "lost") throw new Error("committed acknowledgement lost");
      if (mode === "sql") return { data: null, error: { code: "40001" } };
      return {
        data:
          mode === "false"
            ? { success: true }
            : {
                request_id:
                  mode === "request"
                    ? "77777777-7777-4777-8777-777777777777"
                    : editFixture().deletion.requestId,
                epoch: mode === "epoch" ? 3 : 2,
                deleted: 2,
              },
        error: null,
      };
    });
    await expect(edit.prepare()).rejects.toThrow();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0][1].p_action).toBe("delete");
  },
);
it("changed content with the same preallocated identity changes the admission hash instead of claiming freshness", async () => {
  const a = editFixture(),
    b = editFixture();
  b.editedUserMessage.parts[0].text = "changed";
  const one = await createFencedEditedTurn(a, executeChatFenceCommand).prepare();
  const two = await createFencedEditedTurn(b, executeChatFenceCommand).prepare();
  expect(one.admission.payload.request_id).toBe(two.admission.payload.request_id);
  expect(one.admission.payload.input_hash).not.toBe(two.admission.payload.input_hash);
});
it("retains projected snapshot material without retaining workflow credential bytes", async () => {
  const input = editFixture();
  Object.assign(input.workflowInput.agentContext, { recoupAccessToken: "synthetic-do-not-retain" });
  const result = await createFencedEditedTurn(input, executeChatFenceCommand).prepare();
  expect(JSON.stringify(result)).not.toContain("synthetic-do-not-retain");
  expect(result.admission.payload.execution_snapshot.content.credentialPolicy).toEqual(
    input.credentialPolicy,
  );
});
