import { execFileSync, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { executeChatFenceCommand } from "@/lib/supabase/chat_fence/executeChatFenceCommand";
import { captureFencedEditedTurn } from "../captureFencedEditedTurn";
import { createFencedAtomicEdit } from "../createFencedAtomicEdit";
import { readOriginalFencedEdit } from "../readOriginalFencedEdit";
import { createFencedTrailingDelete } from "../../deletion/createFencedTrailingDelete";
import { encodeStrictJson } from "../../encodeStrictJson";
import { verifyChatAdmissionSnapshot } from "../../verifyChatAdmissionSnapshot";
import { editFixture } from "./editFixture";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/serverClient", () => ({ default: { rpc } }));
const pin = "aeb346cc53bf8c45031fe56b7bf64659329161b2";
const results: unknown[] = [];
const quote = (value: string) => "'" + value.replaceAll("'", "''") + "'";
function args() {
  const socket = process.env.CHAT_EDIT_SQL_SOCKET!;
  if (!/^\/private\/tmp\/f636-[^/]+\/sock$/.test(socket) || process.env.CHAT_EDIT_SQL_PIN !== pin)
    throw new Error("Pinned disposable SQL only");
  return [
    "-X",
    "-qAt",
    "-v",
    "ON_ERROR_STOP=1",
    "-v",
    "VERBOSITY=verbose",
    "-h",
    socket,
    "-d",
    "postgres",
  ];
}
function sql(text: string) {
  return execFileSync(process.env.CHAT_EDIT_SQL_PSQL!, args(), {
    input: text,
    encoding: "utf8",
    timeout: 15000,
  }).trim();
}
function transport(
  _name: string,
  command: { p_chat: string; p_account: string; p_action: string; p: unknown },
) {
  if (
    ![
      "delete_edit",
      "deletion_snapshot",
      "delete",
      "state",
      "admit",
      "admission_snapshot",
    ].includes(command.p_action)
  )
    throw new Error("Unexpected effect in integration transport");
  const text = `SELECT public.chat_fence_command(${quote(command.p_chat)},${quote(command.p_account)},${quote(command.p_action)},${quote(JSON.stringify(command.p))}::jsonb);`;
  const response = spawnSync(process.env.CHAT_EDIT_SQL_PSQL!, [...args(), "-U", "service_role"], {
    input: text,
    encoding: "utf8",
    timeout: 15000,
  });
  if (response.error) throw response.error;
  if (response.status !== 0) {
    const code = response.stderr.match(/ERROR:\s+([0-9A-Z]{5}):/)?.[1];
    if (!code) throw new Error("SQL error lacked SQLSTATE");
    return { data: null, error: { code } };
  }
  return { data: JSON.parse(response.stdout.trim()), error: null };
}
function fixture() {
  const input = editFixture();
  input.editedUserMessage.parts[0].text = "edited 🎵 café\nsecond line";
  Object.assign(input.editedUserMessage.metadata, { "10": "ten", "2": "two", unicode: "🎵" });
  const chat = "atomic-api-" + randomUUID();
  input.deletion.chatId = input.workflowInput.chatId = chat;
  input.workflowInput.sessionId = chat;
  input.deletion.expectedEpoch = 0;
  input.workflowInput.messages = input.workflowInput.messages.map((m, i) => ({
    ...m,
    id: `${chat}-${i}`,
  }));
  input.deletion.anchorId = input.editedUserMessage.id = input.workflowInput.messages[2].id;
  input.replacementUserId = chat + "-replacement";
  const account = input.deletion.effectiveAccount;
  sql(
    `INSERT INTO sessions(id,account_id,title) VALUES(${quote(chat)},${quote(account)},'synthetic'); INSERT INTO chats(id,session_id,title) VALUES(${quote(chat)},${quote(chat)},'synthetic');`,
  );
  // Seed legacy source history before enrollment; equal timestamps exercise DB id ordering.
  for (const message of input.workflowInput.messages)
    sql(
      `INSERT INTO chat_messages(id,chat_id,role,parts,created_at) VALUES(${quote(message.id)},${quote(chat)},${quote(message.role)},${quote(JSON.stringify(message))}::jsonb,'2026-01-01T00:00:00Z');`,
    );
  sql(`SELECT public.enable_chat_fence(${quote(chat)},${quote(account)});`);
  const witness = JSON.parse(
    sql(
      `SELECT jsonb_agg(jsonb_build_object('id',id,'role',role,'message',parts) ORDER BY created_at,id) FROM chat_messages WHERE chat_id=${quote(chat)};`,
    ),
  );
  input.workflowInput.messages = witness.map(
    (row: { message: (typeof input.workflowInput.messages)[number] }) => row.message,
  );
  const capture = captureFencedEditedTurn(input).read();
  const scope = {
    chatId: chat,
    effectiveAccount: account,
    sessionId: chat,
    requestId: input.deletion.requestId,
  };
  const material = {
    capture,
    user_intent_canonical: encodeStrictJson({
      anchor_id: input.deletion.anchorId,
      edited_user_message: input.editedUserMessage,
      requested_options: {},
    }),
    history_witness: witness,
  };
  return {
    input,
    scope,
    material,
    edit: createFencedAtomicEdit(scope, material, executeChatFenceCommand),
  };
}
function inventory(chat: string) {
  return JSON.parse(
    sql(
      `SELECT jsonb_build_object('state',(SELECT to_jsonb(s) FROM chat_fence.state s WHERE chat_id=${quote(chat)}),'messages',(SELECT jsonb_agg(parts ORDER BY created_at,id) FROM chat_messages WHERE chat_id=${quote(chat)}),'turns',(SELECT count(*) FROM chat_fence.turns WHERE chat_id=${quote(chat)}),'deletions',(SELECT count(*) FROM chat_fence.deletions WHERE chat_id=${quote(chat)}),'tombstones',(SELECT count(*) FROM chat_fence.tombstones WHERE chat_id=${quote(chat)}),'slot',(SELECT active_stream_id FROM chats WHERE id=${quote(chat)}));`,
    ),
  );
}
async function readAdmission(
  scope: ReturnType<typeof fixture>["scope"],
  command: ReturnType<ReturnType<typeof captureFencedEditedTurn>["read"]>["admission"],
) {
  const result = await executeChatFenceCommand(scope.chatId, scope.effectiveAccount, {
    action: "admission_snapshot",
    payload: { request_id: command.payload.request_id },
  });
  if (!result.ok || result.action !== "admission_snapshot")
    throw new Error("Expected original admission snapshot");
  const verified = verifyChatAdmissionSnapshot(
    {
      chatId: scope.chatId,
      sessionId: scope.sessionId,
      effectiveAccountId: scope.effectiveAccount,
      requestId: command.payload.request_id,
      expectedEpoch: command.payload.expected_epoch,
    },
    result.value,
  );
  expect(verified.admission_canonical).toBe(command.payload.admission_canonical);
  expect(verified.execution_canonical).toBe(command.payload.execution_canonical);
  return verified;
}
describe.runIf(!!process.env.CHAT_EDIT_SQL_SOCKET)(
  "actual API boundary against pinned atomic SQL",
  () => {
    beforeEach(() => {
      vi.resetAllMocks();
      rpc.mockImplementation(transport);
    });
    afterAll(() => {
      if (process.env.CHAT_EDIT_SQL_RESULTS)
        writeFileSync(
          process.env.CHAT_EDIT_SQL_RESULTS,
          JSON.stringify({ sqlPin: pin, postgres: sql("SHOW server_version;"), results }, null, 2) +
            "\n",
        );
    });
    it("explicit saved-original admission preserves canonical bytes and original identities on replay", async () => {
      const { scope, material, edit } = fixture();
      await edit.delete();
      const saved = await readOriginalFencedEdit(scope, executeChatFenceCommand);
      const command = saved.edit_material.capture.admission;
      const originalBytes = encodeStrictJson(material.capture.admission);
      expect(encodeStrictJson(command)).toBe(originalBytes);
      const before = inventory(scope.chatId);
      const admitted = await executeChatFenceCommand(scope.chatId, scope.effectiveAccount, command);
      expect(admitted).toMatchObject({
        ok: true,
        action: "admit",
        value: {
          chat_id: scope.chatId,
          request_id: command.payload.request_id,
          expected_epoch: 1,
          epoch: 2,
          input_hash: command.payload.input_hash,
          closed: false,
          bound_run_id: null,
        },
      });
      const snapshot = await readAdmission(scope, command);
      expect(snapshot.receipt).toEqual(admitted.ok && admitted.value);
      expect(snapshot.admission_canonical).toBe(command.payload.admission_canonical);
      expect(snapshot.execution_canonical).toBe(command.payload.execution_canonical);
      expect(snapshot.execution_snapshot.id).toBe(command.payload.execution_snapshot.id);
      expect(snapshot.admission_envelope.messages.at(-1)?.id).toBe(
        command.payload.admission_envelope.messages.at(-1)?.id,
      );
      expect(snapshot.dispatch).toEqual({ status: "never_attempted", attempt_id: null });
      const state = inventory(scope.chatId);
      expect(state).toMatchObject({
        turns: 1,
        deletions: 1,
        tombstones: 2,
        state: { epoch: 2, phase: "pending", owner: command.payload.request_id, run_id: null },
        slot: "pending-" + command.payload.request_id,
      });
      expect(state.messages).toEqual(before.messages);
      expect(await executeChatFenceCommand(scope.chatId, scope.effectiveAccount, command)).toEqual(
        admitted,
      );
      expect(inventory(scope.chatId)).toEqual(state);
      expect(encodeStrictJson((await edit.read()).edit_material.capture.admission)).toBe(
        originalBytes,
      );
      expect(rpc.mock.calls.map(([, c]) => c.p_action)).toEqual([
        "delete_edit",
        "deletion_snapshot",
        "admit",
        "admission_snapshot",
        "admit",
        "deletion_snapshot",
      ]);
      results.push({
        case: "explicit-admission-original-bytes",
        scope,
        command,
        admitted,
        snapshot,
        state,
      });
    });
    it("explicit saved-original admission recovers a lost committed acknowledgement without retry or dispatch", async () => {
      const { scope, edit } = fixture();
      await edit.delete();
      const command = (await edit.read()).edit_material.capture.admission;
      const before = inventory(scope.chatId);
      const count = rpc.mock.calls.length;
      rpc.mockImplementationOnce((name, wire) => {
        const result = transport(name, wire);
        expect(result.error).toBeNull();
        throw new Error("discard committed admission response");
      });
      const lost = await executeChatFenceCommand(scope.chatId, scope.effectiveAccount, command);
      expect(lost).toEqual({
        ok: false,
        error: { kind: "transport_ambiguous", retrySameCommand: false },
      });
      expect(rpc).toHaveBeenCalledTimes(count + 1);
      const committed = inventory(scope.chatId);
      expect(committed).toMatchObject({
        turns: 1,
        state: { epoch: 2, phase: "pending", owner: command.payload.request_id, run_id: null },
      });
      expect(committed.messages).toEqual(before.messages);
      const snapshot = await readAdmission(scope, command);
      expect(snapshot.receipt).toMatchObject({
        request_id: command.payload.request_id,
        expected_epoch: 1,
        epoch: 2,
        input_hash: command.payload.input_hash,
        closed: false,
        bound_run_id: null,
      });
      expect(snapshot.dispatch).toEqual({ status: "never_attempted", attempt_id: null });
      expect(inventory(scope.chatId)).toEqual(committed);
      expect(rpc.mock.calls.map(([, c]) => c.p_action)).toEqual([
        "delete_edit",
        "deletion_snapshot",
        "admit",
        "admission_snapshot",
      ]);
      results.push({
        case: "explicit-admission-lost-ack-recovery",
        scope,
        command,
        lost,
        snapshot,
        state: committed,
      });
    });
    it("explicit saved-original admission conflicts after actual competing admission without adopting its owner", async () => {
      const { input, scope, material, edit } = fixture();
      const receipt = await edit.delete();
      const original = (await edit.read()).edit_material.capture.admission;
      const originalBytes = encodeStrictJson(original);
      input.admissionRequestId = randomUUID();
      input.replacementUserId += "-competing";
      input.snapshotId += "-competing";
      const competing = captureFencedEditedTurn(input).read().admission;
      const admitted = await executeChatFenceCommand(
        scope.chatId,
        scope.effectiveAccount,
        competing,
      );
      expect(admitted).toMatchObject({
        ok: true,
        action: "admit",
        value: {
          request_id: competing.payload.request_id,
          expected_epoch: 1,
          epoch: 2,
          closed: false,
          bound_run_id: null,
        },
      });
      const winner = await readAdmission(scope, competing);
      expect(winner.dispatch).toEqual({ status: "never_attempted", attempt_id: null });
      const before = inventory(scope.chatId);
      expect(before).toMatchObject({
        turns: 1,
        state: {
          epoch: 2,
          phase: "pending",
          owner: competing.payload.request_id,
          run_id: null,
        },
        slot: "pending-" + competing.payload.request_id,
      });
      expect(await edit.delete()).toEqual(receipt);
      const recovered = await edit.read();
      expect(recovered.edit_material).toEqual(material);
      expect(encodeStrictJson(recovered.edit_material.capture.admission)).toBe(originalBytes);
      const conflict = await executeChatFenceCommand(
        scope.chatId,
        scope.effectiveAccount,
        recovered.edit_material.capture.admission,
      );
      expect(conflict).toMatchObject({ ok: false, error: { kind: "conflict" } });
      const missing = await executeChatFenceCommand(scope.chatId, scope.effectiveAccount, {
        action: "admission_snapshot",
        payload: { request_id: original.payload.request_id },
      });
      expect(missing).toMatchObject({ ok: false, error: { kind: "not_found" } });
      expect(inventory(scope.chatId)).toEqual(before);
      expect(rpc.mock.calls.map(([, c]) => c.p_action)).toEqual([
        "delete_edit",
        "deletion_snapshot",
        "admit",
        "admission_snapshot",
        "delete_edit",
        "deletion_snapshot",
        "admit",
        "admission_snapshot",
      ]);
      results.push({
        case: "explicit-admission-newer-owner-conflict",
        scope,
        original,
        competing,
        admitted,
        winner,
        conflict,
        missing,
        state: before,
      });
    });
    it("stores actual capture/witness atomically and roundtrips original canonical bytes without admission", async () => {
      const { scope, material, edit } = fixture();
      const receipt = await edit.delete();
      expect(receipt).toEqual({ request_id: scope.requestId, epoch: 1, deleted: 2 });
      const saved = await edit.read();
      expect(encodeStrictJson(saved.edit_material)).toBe(encodeStrictJson(material));
      expect(await edit.delete()).toEqual(receipt);
      const state = inventory(scope.chatId);
      expect(state).toMatchObject({
        state: { epoch: 1, phase: "idle", owner: null, run_id: null },
        turns: 0,
        deletions: 1,
        tombstones: 2,
        slot: null,
      });
      expect(state.messages).toEqual(
        material.history_witness.slice(0, 2).map((r: { message: unknown }) => r.message),
      );
      expect(rpc.mock.calls.map(([, c]) => c.p_action)).toEqual([
        "delete_edit",
        "deletion_snapshot",
        "delete_edit",
      ]);
      results.push({ case: "exact-roundtrip", scope, material, receipt, saved, state });
    });
    it("discards a committed acknowledgement and requires explicit original-key recovery", async () => {
      const { scope, material, edit } = fixture();
      rpc.mockImplementationOnce((name, command) => {
        const result = transport(name, command);
        expect(result.error).toBeNull();
        throw new Error("discard committed response");
      });
      await expect(edit.delete()).rejects.toMatchObject({ kind: "transport_ambiguous" });
      expect(rpc).toHaveBeenCalledTimes(1);
      const state = inventory(scope.chatId);
      expect(state).toMatchObject({ turns: 0, deletions: 1, state: { epoch: 1, phase: "idle" } });
      const saved = await readOriginalFencedEdit(scope, executeChatFenceCommand);
      expect(encodeStrictJson(saved.edit_material)).toBe(encodeStrictJson(material));
      expect(rpc.mock.calls.map(([, c]) => c.p_action)).toEqual([
        "delete_edit",
        "deletion_snapshot",
      ]);
      results.push({ case: "lost-ack-explicit-recovery", scope, saved, state });
    });
    it("rejects changed valid capture under the same key and preserves the original", async () => {
      const { input, scope, material, edit } = fixture();
      await edit.delete();
      const before = inventory(scope.chatId);
      input.editedUserMessage.parts[0].text = "changed intent";
      const changed = {
        ...material,
        capture: captureFencedEditedTurn(input).read(),
        user_intent_canonical: encodeStrictJson({
          anchor_id: input.deletion.anchorId,
          edited_user_message: input.editedUserMessage,
          requested_options: {},
        }),
      };
      await expect(
        createFencedAtomicEdit(scope, changed, executeChatFenceCommand).delete(),
      ).rejects.toMatchObject({ kind: "invalid_command" });
      expect(inventory(scope.chatId)).toEqual(before);
      expect((await edit.read()).edit_material).toEqual(material);
      results.push({ case: "changed-capture-rejected", scope, state: before });
    });
    it("rejects a same-intent different candidate and explicitly reads the original winner", async () => {
      const { input, scope, material, edit } = fixture();
      const receipt = await edit.delete();
      input.replacementUserId += "-loser";
      input.admissionRequestId = randomUUID();
      input.snapshotId += "-loser";
      const candidate = { ...material, capture: captureFencedEditedTurn(input).read() };
      const loser = createFencedAtomicEdit(scope, candidate, executeChatFenceCommand);
      await expect(loser.delete()).rejects.toMatchObject({ kind: "invalid_command" });
      expect(rpc).toHaveBeenCalledTimes(2);
      const saved = await loser.read();
      expect(saved).toEqual({ receipt, edit_material: material });
      expect(inventory(scope.chatId)).toMatchObject({
        deletions: 1,
        turns: 0,
        state: { epoch: 1, phase: "idle" },
      });
      results.push({ case: "same-intent-loser-explicit-winner-read", scope, saved });
    });
    it("denies wrong account/chat/session and missing original identity without disclosure", async () => {
      const { scope, edit } = fixture();
      await edit.delete();
      await expect(
        readOriginalFencedEdit(
          { ...scope, effectiveAccount: "22222222-2222-4222-8222-222222222222" },
          executeChatFenceCommand,
        ),
      ).rejects.toMatchObject({ kind: "forbidden" });
      const other = fixture();
      await expect(
        readOriginalFencedEdit(
          { ...scope, chatId: other.scope.chatId, sessionId: other.scope.sessionId },
          executeChatFenceCommand,
        ),
      ).rejects.toMatchObject({ kind: "not_found" });
      await expect(
        readOriginalFencedEdit({ ...scope, sessionId: "wrong" }, executeChatFenceCommand),
      ).rejects.toMatchObject({ kind: "invalid_receipt" });
      await expect(
        readOriginalFencedEdit({ ...scope, requestId: randomUUID() }, executeChatFenceCommand),
      ).rejects.toMatchObject({ kind: "not_found" });
      results.push({ case: "scope-rejections", scope });
    });
    it("replays original receipt after synthetic newer-owner setup without adopting it", async () => {
      const { scope, edit } = fixture();
      const receipt = await edit.delete();
      const owner = randomUUID();
      // Fixture-only setup avoids issuing admit/start; this does not qualify admission itself.
      sql(
        `SET ROLE recoup_chat_fence_owner; UPDATE chat_fence.state SET epoch=2,phase='pending',owner=${quote(owner)} WHERE chat_id=${quote(scope.chatId)}; UPDATE chats SET active_stream_id=${quote("pending-" + owner)} WHERE id=${quote(scope.chatId)};`,
      );
      const before = inventory(scope.chatId);
      expect(await edit.delete()).toEqual(receipt);
      expect((await edit.read()).receipt).toEqual(receipt);
      expect(inventory(scope.chatId)).toEqual(before);
      expect(before.state.owner).toBe(owner);
      expect(before.turns).toBe(0);
      results.push({ case: "synthetic-newer-owner-replay", scope, receipt, state: before });
    });
    it("keeps legacy deletion receipts and null snapshots compatible, rejects cross-mode replay", async () => {
      const { input, scope, edit } = fixture();
      const legacy = createFencedTrailingDelete(input.deletion, executeChatFenceCommand);
      const receipt = await legacy.delete();
      expect(await legacy.delete()).toEqual(receipt);
      const saved = await executeChatFenceCommand(scope.chatId, scope.effectiveAccount, {
        action: "deletion_snapshot",
        payload: { request_id: scope.requestId },
      });
      expect(saved).toEqual({
        ok: true,
        action: "deletion_snapshot",
        value: { receipt, edit_material: null },
      });
      await expect(edit.delete()).rejects.toMatchObject({ kind: "invalid_command" });
      await expect(edit.read()).rejects.toMatchObject({ kind: "invalid_receipt" });
      results.push({ case: "legacy-delete-compatible", scope, receipt, saved });
    });
    it("rejects stale DB history witness before deleting anything", async () => {
      const { scope, edit } = fixture();
      sql(
        `SET ROLE recoup_chat_fence_owner; UPDATE chat_messages SET parts=jsonb_set(parts,'{parts,0,text}','"changed source"') WHERE chat_id=${quote(scope.chatId)};`,
      );
      const before = inventory(scope.chatId);
      await expect(edit.delete()).rejects.toMatchObject({ kind: "conflict" });
      expect(inventory(scope.chatId)).toEqual(before);
      results.push({ case: "stale-history-rejected", scope, state: before });
    });
  },
);
