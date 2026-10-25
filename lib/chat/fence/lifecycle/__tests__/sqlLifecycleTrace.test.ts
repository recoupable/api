import { buildChatExecutionSnapshot } from "../../buildChatExecutionSnapshot";
import { canonicalizeChatAdmission } from "../../canonicalizeChatAdmission";
import { writeFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import { getRun } from "workflow/api";
import { stopFencedChatWorkflow } from "../stopFencedChatWorkflow";
import { resumeFencedChatStream } from "../resumeFencedChatStream";
import { account, requestId, workflowInput, policy } from "../../__tests__/snapshotFixture";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/serverClient", () => ({ default: { rpc } }));
vi.mock("workflow/api", () => ({ getRun: vi.fn() }));
it("records actual adapter RPC commands and synthetic SDK evidence for pinned SQL qualification", async () => {
  const baseTarget = {
    chatId: "chat",
    effectiveAccount: account,
    epoch: 1,
    owner: requestId,
    phase: "running" as const,
    runId: "original-run",
  };
  const baseCurrent = {
    chat_id: "chat",
    epoch: 1,
    owner: requestId,
    phase: "running",
    run_id: baseTarget.runId,
  };
  const baseNewer = {
    chat_id: "chat",
    epoch: 2,
    owner: "55555555-5555-4555-8555-555555555555",
    phase: "running",
    run_id: "newer-run",
  };
  const traces = [];
  for (const name of [
    "pending-stop",
    "pending-resume",
    "stop-success",
    "resume-terminal",
    "stale-original",
    "closed-original",
    "release-race",
    "cancel-failure",
    "resume-status-failure",
  ]) {
    const target = { ...baseTarget, chatId: `lifecycle-${name}`, runId: `original-${name}` };
    const current = { ...baseCurrent, chat_id: target.chatId, run_id: target.runId };
    const newer = { ...baseNewer, chat_id: target.chatId };
    const inputSnapshot = { ...workflowInput, chatId: target.chatId, sessionId: `session-${name}` };
    const execution = buildChatExecutionSnapshot({
      id: `snapshot-${name}`,
      requestId,
      workflowInput: inputSnapshot,
      credentialPolicy: policy,
    });
    const canonical = canonicalizeChatAdmission({
      contractVersion: "chat-admission/v1",
      effectiveAccountId: account,
      chatId: target.chatId,
      sessionId: inputSnapshot.sessionId,
      expectedEpoch: 0,
      messages: inputSnapshot.messages,
      options: { modelId: inputSnapshot.modelId },
      executionSnapshot: { id: execution.snapshot.id, digest: execution.digest },
    });
    const admission = {
      request_id: requestId,
      expected_epoch: 0,
      input_hash: canonical.inputHash,
      admission_envelope: canonical.envelope,
      execution_snapshot: execution.snapshot,
      admission_canonical: canonical.canonical,
      execution_canonical: execution.canonical,
    };
    vi.mocked(getRun).mockReset();
    rpc.mockReset();
    const commands: unknown[] = [];
    const sdk: unknown[] = [];
    const state =
      name === "stale-original"
        ? newer
        : name === "closed-original"
          ? { chat_id: target.chatId, epoch: 1, owner: null, phase: "idle", run_id: null }
          : current;
    rpc.mockImplementation(async (_name, args) => {
      const receipt = args.p_action === "state" ? state : { released: name !== "release-race" };
      commands.push({ args: structuredClone(args), receipt });
      return { data: receipt, error: null };
    });
    vi.mocked(getRun).mockImplementation(id => {
      sdk.push({ operation: "getRun", id });
      return {
        cancel: async () => {
          sdk.push({ operation: "cancel", id });
          if (name === "cancel-failure") throw new Error("synthetic cancel failure");
        },
        get status() {
          sdk.push({ operation: "status", id });
          return name === "resume-status-failure"
            ? Promise.reject(new Error("synthetic status failure"))
            : Promise.resolve("cancelled");
        },
      } as never;
    });
    const input = name.startsWith("pending")
      ? { ...target, phase: "pending" as const, runId: null }
      : target;
    const response = name.includes("resume")
      ? await resumeFencedChatStream(input, new URL("https://api.test/stream"))
      : await stopFencedChatWorkflow(input);
    const status =
      name === "stop-success" || name === "resume-terminal"
        ? 200
        : name === "cancel-failure" || name === "resume-status-failure"
          ? 502
          : 503;
    expect(response.status).toBe(status);
    if (name.startsWith("pending")) {
      expect(commands).toEqual([]);
      expect(sdk).toEqual([]);
    }
    if (name === "stale-original" || name === "closed-original") expect(sdk).toEqual([]);
    expect(vi.mocked(getRun).mock.calls.every(([id]) => id === target.runId)).toBe(true);
    await response.text();
    traces.push({ name, target: input, admission, commands, sdk, httpStatus: response.status });
  }
  if (process.env.CHAT_LIFECYCLE_TRACE_OUTPUT)
    writeFileSync(
      process.env.CHAT_LIFECYCLE_TRACE_OUTPUT,
      JSON.stringify(
        {
          traces,
          limits:
            "Actual lifecycle adapters/RPC boundary and synthetic workflow SDK cancel/status. Separate disposable SQL replay; no live provider cancellation or authorization proof.",
        },
        null,
        2,
      ) + "\n",
    );
});
