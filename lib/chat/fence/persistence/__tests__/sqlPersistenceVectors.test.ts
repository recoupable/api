import { readFileSync, writeFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import type { UIMessage } from "ai";
import { createFencedMessageWriter } from "../createFencedMessageWriter";
import { executeChatFenceCommand } from "@/lib/supabase/chat_fence/executeChatFenceCommand";
import { buildChatExecutionSnapshot } from "../../buildChatExecutionSnapshot";
import { canonicalizeChatAdmission } from "../../canonicalizeChatAdmission";
import { account, policy, workflowInput } from "../../__tests__/snapshotFixture";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/serverClient", () => ({ default: { rpc } }));
const owners = [
  "22222222-2222-4222-8222-222222222222",
  "55555555-5555-4555-8555-555555555555",
  "66666666-6666-4666-8666-666666666666",
];
const epochs = [1, 2, 4];
const message = (id: string, role: "user" | "assistant", text = "hello"): UIMessage => ({
  id,
  role,
  parts: [{ type: "text", text }],
  metadata: { trace: { source: "synthetic" } },
});
it("captures API-generated admissions and actual writer commands for exact SQL qualification", async () => {
  const admissions = owners.map((requestId, i) => {
    const execution = buildChatExecutionSnapshot({
      id: `persistence-${i}`,
      requestId,
      workflowInput,
      credentialPolicy: policy,
    });
    const admission = canonicalizeChatAdmission({
      contractVersion: "chat-admission/v1",
      effectiveAccountId: account,
      chatId: "chat",
      sessionId: "session",
      expectedEpoch: epochs[i] - 1,
      messages: workflowInput.messages,
      options: { modelId: workflowInput.modelId },
      executionSnapshot: { id: execution.snapshot.id, digest: execution.digest },
    });
    return {
      request_id: requestId,
      expected_epoch: epochs[i] - 1,
      input_hash: admission.inputHash,
      admission_envelope: admission.envelope,
      execution_snapshot: execution.snapshot,
      admission_canonical: admission.canonical,
      execution_canonical: execution.canonical,
    };
  });
  const commands: Record<string, unknown> = {};
  const writers = owners.map((owner, i) =>
    createFencedMessageWriter(
      {
        chatId: "chat",
        effectiveAccount: account,
        epoch: epochs[i],
        owner,
        runId: `original-run-${i}`,
      },
      executeChatFenceCommand,
    ),
  );
  async function capture(name: string, operation: () => Promise<unknown>, update = false) {
    rpc.mockResolvedValue({
      data: update ? { updated: true } : { written: true, outcome: "inserted" },
      error: null,
    } as never);
    await operation();
    const args = rpc.mock.calls.at(-1)![1] as { p_action: string; p: unknown };
    commands[name] = { action: args.p_action, payload: args.p };
  }
  await capture("user", () => writers[0].insertUser(message("user-1", "user")));
  await capture("changedUser", () => writers[0].insertUser(message("user-1", "user", "changed")));
  await capture("assistant", () => writers[0].upsertAssistant(message("assistant-1", "assistant")));
  await capture("assistantChanged", () =>
    writers[0].upsertAssistant(message("assistant-1", "assistant", "changed")),
  );
  await capture(
    "parts",
    () => writers[0].updateAssistantParts(message("assistant-1", "assistant", "data part")),
    true,
  );
  await capture(
    "missing",
    () => writers[0].updateAssistantParts(message("missing", "assistant")),
    true,
  );
  await capture("ambiguous", () => writers[0].insertUser(message("ambiguous-user", "user")));
  await capture("previousAssistant", () =>
    writers[1].upsertAssistant(message("assistant-1", "assistant", "data part")),
  );
  await capture(
    "previousParts",
    () => writers[1].updateAssistantParts(message("assistant-1", "assistant")),
    true,
  );
  await capture("historicalAssistant", () =>
    writers[1].upsertAssistant(message("historical", "assistant")),
  );
  await capture(
    "historicalParts",
    () => writers[1].updateAssistantParts(message("historical", "assistant")),
    true,
  );
  await capture("crossGenerationUserReplay", () =>
    writers[1].insertUser(message("user-1", "user")),
  );
  await capture("deletedUser", () => writers[2].insertUser(message("user-1", "user")));
  await capture("deletedAssistant", () =>
    writers[2].upsertAssistant(message("assistant-1", "assistant")),
  );
  const vectors = { account, admissions, commands, historical: message("historical", "assistant") };
  const path = "scripts/chat-fence-fixture/persistence-vectors.json";
  if (process.env.CHAT_FENCE_WRITE_PERSISTENCE_VECTORS)
    writeFileSync(path, JSON.stringify(vectors, null, 2) + "\n");
  expect(vectors).toEqual(JSON.parse(readFileSync(path, "utf8")));
});
it.runIf(Boolean(process.env.CHAT_FENCE_PERSISTENCE_SQL_RESULT))(
  "validates actual SQL receipts/errors through the RPC boundary and required writer",
  async () => {
    const results = JSON.parse(
      readFileSync(process.env.CHAT_FENCE_PERSISTENCE_SQL_RESULT!, "utf8"),
    );
    expect(results.length).toBeGreaterThanOrEqual(20);
    for (const entry of results) {
      const p = entry.command.payload;
      const writer = createFencedMessageWriter(
        {
          chatId: "chat",
          effectiveAccount: account,
          epoch: p.epoch,
          owner: p.owner,
          runId: p.run_id,
        },
        executeChatFenceCommand,
      );
      rpc.mockReset();
      if (entry.dropAcknowledgement)
        rpc.mockRejectedValue(new Error("synthetic loss after SQL commit"));
      else
        rpc.mockResolvedValue({
          data: entry.receipt ?? null,
          error: entry.code ? { code: entry.code } : null,
        } as never);
      const result =
        entry.command.action === "update_parts"
          ? writer.updateAssistantParts(p.parts)
          : p.role === "user"
            ? writer.insertUser(p.parts)
            : writer.upsertAssistant(p.parts);
      if (entry.dropAcknowledgement)
        await expect(result).rejects.toMatchObject({ kind: "transport_ambiguous" });
      else if (entry.code)
        await expect(result).rejects.toThrow("Required fenced persistence failed");
      else if (entry.receipt.updated === false)
        await expect(result).rejects.toMatchObject({ kind: "missing_message" });
      else await expect(result).resolves.toEqual(entry.receipt);
      expect(rpc).toHaveBeenCalledTimes(1);
    }
  },
);
