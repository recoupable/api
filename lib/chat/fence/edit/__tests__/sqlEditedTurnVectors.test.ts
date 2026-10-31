import { readFileSync, writeFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import { createFencedEditedTurn } from "../createFencedEditedTurn";
import { executeChatFenceCommand } from "@/lib/supabase/chat_fence/executeChatFenceCommand";
import { buildChatExecutionSnapshot } from "../../buildChatExecutionSnapshot";
import { canonicalizeChatAdmission } from "../../canonicalizeChatAdmission";
import { editFixture } from "./editFixture";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/serverClient", () => ({ default: { rpc } }));
const path = "scripts/chat-fence-edit/vectors.json";
it("binds actual captured delete/preparation bytes to the committed SQL vectors", async () => {
  const vectors = [];
  for (const name of ["success", "newer-owner", "lost-ack", "unseen-collision"]) {
    const input = editFixture();
    input.deletion.chatId = `edited-${name}`;
    input.workflowInput.chatId = input.deletion.chatId;
    input.workflowInput.sessionId = `session-${name}`;
    input.workflowInput.messages = input.workflowInput.messages.map(m => ({
      ...m,
      id: `${name}/${m.id}`,
    }));
    input.deletion.anchorId = `${name}/old-user`;
    input.editedUserMessage.id = input.deletion.anchorId;
    input.replacementUserId = `${name}/fresh-edited-user`;
    input.tombstonedMessageIds = [];
    const execution = buildChatExecutionSnapshot({
      id: `original-${name}`,
      requestId: "22222222-2222-4222-8222-222222222222",
      workflowInput: input.workflowInput,
      credentialPolicy: input.credentialPolicy,
    });
    const admission = canonicalizeChatAdmission({
      contractVersion: "chat-admission/v1",
      effectiveAccountId: input.deletion.effectiveAccount,
      chatId: input.deletion.chatId,
      sessionId: input.workflowInput.sessionId,
      expectedEpoch: 0,
      messages: input.workflowInput.messages,
      options: execution.snapshot.content.options,
      executionSnapshot: { id: execution.snapshot.id, digest: execution.digest },
    });
    const initial = {
      request_id: execution.snapshot.requestId,
      expected_epoch: 0,
      input_hash: admission.inputHash,
      admission_envelope: admission.envelope,
      execution_snapshot: execution.snapshot,
      admission_canonical: admission.canonical,
      execution_canonical: execution.canonical,
    };
    const deleteReceipt = { request_id: input.deletion.requestId, epoch: 2, deleted: 2 };
    rpc.mockReset();
    rpc.mockResolvedValue({ data: deleteReceipt, error: null });
    const edit = createFencedEditedTurn(input, executeChatFenceCommand);
    const prepared = await edit.prepare();
    const commands = structuredClone(rpc.mock.calls.map(([, args]) => args));
    expect(commands.map(c => c.p_action)).toEqual(["delete"]);
    input.editedUserMessage.parts[0].text = "changed-content-same-identity";
    const changed = await createFencedEditedTurn(input, executeChatFenceCommand).prepare();
    rpc.mockRejectedValue(new Error("synthetic committed delete acknowledgement loss"));
    await expect(edit.prepare()).rejects.toThrow();
    const replayInput = {
      ...input,
      editedUserMessage: {
        ...input.editedUserMessage,
        parts: [{ type: "text" as const, text: "edited" }],
      },
    };
    rpc.mockResolvedValue({ data: deleteReceipt, error: null });
    const replay = await createFencedEditedTurn(replayInput, executeChatFenceCommand).prepare();
    expect(replay).toEqual(prepared);
    vectors.push({ name, initial, prepared, changed, commands, deleteReceipt });
  }
  const bytes = JSON.stringify(vectors, null, 2) + "\n";
  if (process.env.WRITE_EDITED_TURN_VECTORS) writeFileSync(path, bytes);
  expect(readFileSync(path, "utf8")).toBe(bytes);
});
it.runIf(!!process.env.EDITED_TURN_SQL_RESULTS)(
  "feeds actual SQL deletion receipts through captured preparation without automatic admission",
  async () => {
    const results = JSON.parse(readFileSync(process.env.EDITED_TURN_SQL_RESULTS!, "utf8"));
    for (const row of results) {
      const input = editFixture();
      const name = row.name;
      input.deletion.chatId = `edited-${name}`;
      input.workflowInput.chatId = input.deletion.chatId;
      input.workflowInput.sessionId = `session-${name}`;
      input.workflowInput.messages = input.workflowInput.messages.map(m => ({
        ...m,
        id: `${name}/${m.id}`,
      }));
      input.deletion.anchorId = `${name}/old-user`;
      input.editedUserMessage.id = input.deletion.anchorId;
      input.replacementUserId = `${name}/fresh-edited-user`;
      input.tombstonedMessageIds = [];
      const edit = createFencedEditedTurn(input, executeChatFenceCommand);
      rpc.mockReset();
      rpc.mockImplementation(async () => {
        if (row.name === "lost-ack") throw new Error("lost SQL acknowledgement");
        return { data: row.deleteReceipt, error: null };
      });
      if (row.name === "lost-ack") await expect(edit.prepare()).rejects.toThrow();
      else expect((await edit.prepare()).admission).toEqual(row.admission);
      expect(rpc.mock.calls.map(([, args]) => args.p_action)).toEqual(["delete"]);
    }
  },
);
