import { readFileSync, writeFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import { createFencedTrailingDelete } from "../createFencedTrailingDelete";
import { executeChatFenceCommand } from "@/lib/supabase/chat_fence/executeChatFenceCommand";
import { buildChatExecutionSnapshot } from "../../buildChatExecutionSnapshot";
import { canonicalizeChatAdmission } from "../../canonicalizeChatAdmission";
import { account, policy, workflowInput } from "../../__tests__/snapshotFixture";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/serverClient", () => ({ default: { rpc } }));
const request = (digit: string) =>
  `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${digit.repeat(12)}`;
it("captures exact adapter commands and API-generated setup admissions", async () => {
  const admissions = [0, 2].map((expectedEpoch, index) => {
    const requestId = request(index === 0 ? "7" : "8");
    const execution = buildChatExecutionSnapshot({
      id: `delete-${index}`,
      requestId,
      workflowInput,
      credentialPolicy: policy,
    });
    const admission = canonicalizeChatAdmission({
      contractVersion: "chat-admission/v1",
      effectiveAccountId: account,
      chatId: "chat",
      sessionId: "session",
      expectedEpoch,
      messages: workflowInput.messages,
      options: { modelId: workflowInput.modelId },
      executionSnapshot: { id: execution.snapshot.id, digest: execution.digest },
    });
    return {
      request_id: requestId,
      expected_epoch: expectedEpoch,
      input_hash: admission.inputHash,
      admission_envelope: admission.envelope,
      execution_snapshot: execution.snapshot,
      admission_canonical: admission.canonical,
      execution_canonical: execution.canonical,
    };
  });
  const commands: Record<string, unknown> = {};
  for (const [name, expectedEpoch, requestId, anchorId, effectiveAccount] of [
    ["active", 1, request("2"), "b", account],
    ["stale", 0, request("3"), "b", account],
    ["delete", 1, request("4"), "b", account],
    ["changed", 1, request("4"), "c", account],
    ["rollback", 1, request("5"), "b", account],
    ["foreignAnchor", 1, request("6"), "foreign-message", account],
    ["wrongAccount", 1, request("9"), "b", "22222222-2222-4222-8222-222222222222"],
  ] as const) {
    rpc.mockReset();
    rpc.mockResolvedValue({
      data: { request_id: requestId, epoch: expectedEpoch + 1, deleted: 3 },
      error: null,
    });
    await createFencedTrailingDelete(
      { chatId: "chat", effectiveAccount, expectedEpoch, requestId, anchorId },
      executeChatFenceCommand,
    ).delete();
    expect(rpc).toHaveBeenCalledTimes(1);
    commands[name] = rpc.mock.calls[0][1];
  }
  const vectors = { account, admissions, commands };
  const path = "scripts/chat-fence-delete/vectors.json";
  if (process.env.CHAT_FENCE_WRITE_DELETE_VECTORS)
    writeFileSync(path, JSON.stringify(vectors, null, 2) + "\n");
  expect(vectors).toEqual(JSON.parse(readFileSync(path, "utf8")));
});
it.runIf(Boolean(process.env.CHAT_FENCE_DELETE_SQL_RESULT))(
  "roundtrips actual SQL acknowledgements/errors through the adapter",
  async () => {
    const output = JSON.parse(readFileSync(process.env.CHAT_FENCE_DELETE_SQL_RESULT!, "utf8"));
    expect(output.sqlCommit).toBe("7914f063729db04960149647d9ee19c8f857c417");
    expect(output.results.length).toBeGreaterThanOrEqual(10);
    for (const entry of output.results) {
      const args = entry.args;
      const p = args.p;
      rpc.mockReset();
      if (entry.dropAcknowledgement)
        rpc.mockRejectedValue(new Error("synthetic loss after commit"));
      else
        rpc.mockResolvedValue({
          data: entry.receipt ?? null,
          error: entry.code ? { code: entry.code } : null,
        });
      const adapter = createFencedTrailingDelete(
        {
          chatId: args.p_chat,
          effectiveAccount: args.p_account,
          expectedEpoch: p.expected_epoch,
          requestId: p.request_id,
          anchorId: p.anchor_id,
        },
        executeChatFenceCommand,
      );
      const result = adapter.delete();
      if (entry.dropAcknowledgement)
        await expect(result).rejects.toMatchObject({ kind: "transport_ambiguous" });
      else if (entry.code)
        await expect(result).rejects.toThrow("Required fenced persistence failed");
      else await expect(result).resolves.toEqual(entry.receipt);
      expect(rpc).toHaveBeenCalledExactlyOnceWith("chat_fence_command", args);
    }
  },
);
