import { createHash } from "node:crypto";
import { afterEach } from "vitest";
import { prepareCatalogSurfaceStep } from "../prepareCatalogSurfaceStep";
import { sendCatalogSurfaceStep } from "../sendCatalogSurfaceStep";
import catalogFixture from "@/lib/intelligent-ui/__fixtures__/catalog-streams-v1.json";
import { closeChatStream } from "../closeChatStream";
import { sendStreamStart } from "../sendStreamStart";
import { sendStreamFinish } from "../sendStreamFinish";
import { deleteEphemeralKeyStep } from "../deleteEphemeralKeyStep";
import { convertMessagesStep } from "../convertMessagesStep";
import { it, expect, vi, beforeEach } from "vitest";
import { routeChatModelStep } from "../routeChatModelStep";
import { persistAssistantMessageStep } from "../persistAssistantMessageStep";
import { runAgentWorkflow } from "@/app/lib/workflows/runAgentWorkflow";
import { runAgentStep } from "@/app/lib/workflows/runAgentStep";
import { clearChatActiveStream } from "@/lib/chat/clearChatActiveStream";
import { generateAssistantMessageId } from "@/app/lib/workflows/generateAssistantMessageId";
import { handleChatCredits } from "@/lib/credits/handleChatCredits";
import { autoCommitChatTurn } from "@/lib/chat/auto-commit/autoCommitChatTurn";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/serverClient", () => ({ default: { rpc } }));

vi.mock("@/app/lib/workflows/prepareCatalogSurfaceStep", () => ({
  prepareCatalogSurfaceStep: vi.fn(),
}));
vi.mock("@/app/lib/workflows/sendCatalogSurfaceStep", () => ({ sendCatalogSurfaceStep: vi.fn() }));

vi.mock("@/app/lib/workflows/routeChatModelStep", () => ({ routeChatModelStep: vi.fn() }));
vi.mock("@/app/lib/workflows/deleteEphemeralKeyStep", () => ({
  deleteEphemeralKeyStep: vi.fn(),
}));
vi.mock("@/app/lib/workflows/runAgentStep", () => ({
  runAgentStep: vi.fn(),
}));
vi.mock("@/lib/chat/clearChatActiveStream", () => ({
  clearChatActiveStream: vi.fn(),
}));
vi.mock("@/app/lib/workflows/closeChatStream", () => ({
  closeChatStream: vi.fn(),
}));
vi.mock("@/app/lib/workflows/generateAssistantMessageId", () => ({
  generateAssistantMessageId: vi.fn(),
}));
// The loop's supporting steps — exercised in runAgentWorkflowLoop.test.ts.
vi.mock("@/app/lib/workflows/convertMessagesStep", () => ({
  convertMessagesStep: vi.fn(() => Promise.resolve([])),
}));
vi.mock("@/app/lib/workflows/persistAssistantMessageStep", () => ({
  persistAssistantMessageStep: vi.fn(),
}));
vi.mock("@/app/lib/workflows/sendStreamStart", () => ({ sendStreamStart: vi.fn() }));
vi.mock("@/app/lib/workflows/sendStreamFinish", () => ({ sendStreamFinish: vi.fn() }));
vi.mock("@/lib/credits/handleChatCredits", () => ({
  handleChatCredits: vi.fn(),
}));
vi.mock("@/lib/chat/auto-commit/autoCommitChatTurn", () => ({
  autoCommitChatTurn: vi.fn(),
}));
// Captured writable stub so tests can assert closeChatStream got the
// same instance the workflow body holds.
const writableStub = new WritableStream();
vi.mock("workflow", async importOriginal => ({
  ...(await importOriginal<typeof import("workflow")>()),
  getWritable: vi.fn(() => writableStub),
  getWorkflowMetadata: vi.fn(() => ({
    workflowRunId: "wrun_from_metadata",
    workflowName: "runAgentWorkflow",
    workflowStartedAt: new Date(),
    url: "https://example.invalid/workflow",
  })),
}));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(convertMessagesStep).mockResolvedValue([]);
  vi.mocked(generateAssistantMessageId).mockResolvedValue("asst-fresh-id");
});

const baseInput = {
  messages: [{ id: "m1", role: "user", parts: [{ type: "text", text: "hi" }] } as never],
  chatId: "chat-1",
  sessionId: "session-1",
  accountId: "acc-1",
  modelId: "anthropic/claude-haiku-4.5",
  sessionTitle: "test session",
  repoOwner: "recoupable",
  repoName: "api",
  agentContext: {
    sandbox: { state: { type: "vercel" }, workingDirectory: "/sandbox/mono" },
  } as never,
};

const responseMessageWithMetadata = {
  id: "asst-msg-1",
  role: "assistant",
  parts: [{ type: "text", text: "Hello!" }],
  metadata: {
    totalMessageCost: 0.07,
    totalMessageUsage: { inputTokens: 100, cachedInputTokens: 10, outputTokens: 20 },
  },
} as never;

const authority = {
  chatId: "chat-1",
  effectiveAccount: "11111111-1111-4111-8111-111111111111",
  epoch: 1,
  owner: "22222222-2222-4222-8222-222222222222",
};
const fencedInput = () =>
  ({
    kind: "internal-fenced/v1",
    input: {
      ...baseInput,
      messages: [...baseInput.messages],
      accountId: authority.effectiveAccount,
    },
    fence: { authority, attemptId: "77777777-7777-4777-8777-777777777777", turn: { kind: "new" } },
  }) as never;
const actions = () => rpc.mock.calls.map(([, args]) => args.p_action);
beforeEach(() => {
  rpc.mockImplementation(async (_name, args) => ({
    data:
      args.p_action === "bind"
        ? { bound: true }
        : args.p_action === "release"
          ? { released: true }
          : { written: true, outcome: "inserted" },
    error: null,
  }));
  vi.mocked(runAgentStep).mockResolvedValue({
    finishReason: "stop",
    aborted: false,
    responseMessages: [],
    responseMessage: responseMessageWithMetadata,
  });
});
it("binds first, persists required user/assistant and releases without legacy cleanup", async () => {
  await runAgentWorkflow(fencedInput());
  expect(actions()).toEqual(["bind", "write", "write", "release"]);
  expect(rpc.mock.calls[0][1].p).toMatchObject({
    run_id: "wrun_from_metadata",
    epoch: 1,
    owner: authority.owner,
    attempt_id: "77777777-7777-4777-8777-777777777777",
  });
  expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(
    vi.mocked(generateAssistantMessageId).mock.invocationCallOrder[0],
  );
  expect(persistAssistantMessageStep).not.toHaveBeenCalled();
  expect(clearChatActiveStream).not.toHaveBeenCalled();
});
it("losing duplicate bind exits before provider, stream or key cleanup", async () => {
  rpc.mockResolvedValue({ data: null, error: { code: "40001" } });
  await expect(runAgentWorkflow(fencedInput())).rejects.toThrow();
  expect(actions()).toEqual(["bind"]);
  expect(runAgentStep).not.toHaveBeenCalled();
  expect(generateAssistantMessageId).not.toHaveBeenCalled();
  expect(clearChatActiveStream).not.toHaveBeenCalled();
});
it("required user failure stops routing/provider and leaves authority for reconciliation", async () => {
  rpc.mockImplementation(async (_name, args) => ({
    data: args.p_action === "bind" ? { bound: true } : null,
    error: args.p_action === "bind" ? null : { code: "40001" },
  }));
  await expect(runAgentWorkflow(fencedInput())).rejects.toThrow();
  expect(actions()).toEqual(["bind", "write"]);
  expect(runAgentStep).not.toHaveBeenCalled();
  expect(routeChatModelStep).not.toHaveBeenCalled();
  expect(clearChatActiveStream).not.toHaveBeenCalled();
});

it.each(["bind", "assistant", "release"])(
  "terminalizes ambiguous %s without retry or legacy/key cleanup",
  async phase => {
    rpc.mockImplementation(async (_name, args) => {
      if (
        args.p_action === phase ||
        (phase === "assistant" && args.p_action === "write" && args.p.role === "assistant")
      )
        throw new Error("lost acknowledgement");
      return {
        data: args.p_action === "bind" ? { bound: true } : { written: true, outcome: "inserted" },
        error: null,
      };
    });
    await expect(runAgentWorkflow(fencedInput())).rejects.toThrow(/reconciliation/);
    expect(clearChatActiveStream).not.toHaveBeenCalled();
    expect(deleteEphemeralKeyStep).not.toHaveBeenCalled();
    expect(sendStreamFinish).not.toHaveBeenCalled();
    if (phase === "bind") {
      expect(closeChatStream).not.toHaveBeenCalled();
      expect(sendStreamStart).not.toHaveBeenCalled();
    } else expect(closeChatStream).toHaveBeenCalledTimes(1);
  },
);
it("required assistant failure stops the next provider iteration", async () => {
  vi.mocked(runAgentStep).mockResolvedValue({
    finishReason: "tool-calls",
    aborted: false,
    responseMessages: [],
    responseMessage: responseMessageWithMetadata,
  });
  rpc.mockImplementation(async (_name, args) => ({
    data:
      args.p_action === "bind"
        ? { bound: true }
        : args.p.role === "user"
          ? { written: true, outcome: "inserted" }
          : null,
    error: args.p.role === "assistant" ? { code: "40001" } : null,
  }));
  await expect(runAgentWorkflow(fencedInput())).rejects.toThrow(/reconciliation/);
  expect(runAgentStep).toHaveBeenCalledTimes(1);
  expect(handleChatCredits).not.toHaveBeenCalled();
  expect(autoCommitChatTurn).not.toHaveBeenCalled();
  expect(actions()).not.toContain("release");
});
it("new turn replaces both historical assistant id and pending object", async () => {
  const invocation = fencedInput() as unknown as { input: typeof baseInput };
  invocation.input.messages.push({
    id: "old",
    role: "assistant",
    parts: [{ type: "text", text: "OLD" }],
    metadata: { old: true },
  } as never);
  await runAgentWorkflow(invocation as never);
  expect(vi.mocked(runAgentStep).mock.calls[0][0].originalMessages).toEqual([
    { id: "asst-fresh-id", role: "assistant", parts: [] },
  ]);
});
it("unproven resume message generation fails before provider/routing", async () => {
  const invocation = fencedInput() as unknown as {
    input: typeof baseInput;
    fence: { turn: unknown };
  };
  invocation.input.messages.push({ id: "old", role: "assistant", parts: [] } as never);
  invocation.fence.turn = { kind: "same-turn-resume", assistantId: "old" };
  rpc.mockImplementation(async (_name, args) => ({
    data:
      args.p_action === "bind"
        ? { bound: true }
        : args.p_action === "write"
          ? { written: true, outcome: "exactDuplicate" }
          : { updated: false },
    error: null,
  }));
  await expect(runAgentWorkflow(invocation as never)).rejects.toThrow(/reconciliation/);
  expect(runAgentStep).not.toHaveBeenCalled();
  expect(routeChatModelStep).not.toHaveBeenCalled();
  expect(actions()).toEqual(["bind", "write", "update_parts"]);
});
it("legacy preparation failure preserves the original no-cleanup behavior", async () => {
  vi.mocked(convertMessagesStep).mockRejectedValue(new Error("conversion failed"));
  await expect(runAgentWorkflow(baseInput)).rejects.toThrow("conversion failed");
  expect(rpc).not.toHaveBeenCalled();
  expect(clearChatActiveStream).not.toHaveBeenCalled();
  expect(deleteEphemeralKeyStep).not.toHaveBeenCalled();
  expect(closeChatStream).not.toHaveBeenCalled();
});

afterEach(() => vi.unstubAllEnvs());
it.each([true, false])(
  "consumes server lineage after required snapshot write, before release; retention success=%s",
  async success => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("CATALOG_SURFACE_RETENTION_ENABLED", "true");
    const invocation = fencedInput() as unknown as {
      input: typeof baseInput & { devCatalogSurface?: unknown };
    };
    const query = {
      catalog_id: catalogFixture.surface.context.subject.id,
      since: "2026-09-02",
      days: 1,
      page: 1,
      limit: 25,
    };
    invocation.input.devCatalogSurface = {
      workspaceId: catalogFixture.surface.context.workspaceId,
      query,
    };
    const canonical = JSON.stringify({
      mappingVersion: "catalog-streams-v1",
      workspaceId: catalogFixture.surface.context.workspaceId,
      query,
      lineage: catalogFixture.lineage,
    });
    const hash = (s: string) => createHash("sha256").update(s).digest("hex");
    const prepared = {
      ...catalogFixture,
      fingerprint: hash(canonical),
      sourceEnvelope: {
        version: 1,
        actorId: authority.effectiveAccount,
        assistantMessageId: "asst-fresh-id",
        canonical,
        surfaceSha256: hash(JSON.stringify(catalogFixture.surface)),
      },
    };
    vi.mocked(prepareCatalogSurfaceStep).mockResolvedValue(prepared as never);
    vi.mocked(sendCatalogSurfaceStep).mockResolvedValue({
      id: "asst-fresh-id",
      role: "assistant",
      parts: [
        {
          type: "data-intelligent-ui-snapshot",
          id: catalogFixture.surface.id,
          data: catalogFixture.surface,
        },
      ],
    });
    const original = rpc.getMockImplementation()!;
    rpc.mockImplementation(async (name, args) =>
      name === "retain_catalog_surface_source"
        ? success
          ? {
              data: {
                message_id: "asst-fresh-id",
                source_revision: 1,
                source_sha256: hash(canonical),
                surface_sha256: prepared.sourceEnvelope.surfaceSha256,
                retained: true,
              },
              error: null,
            }
          : { data: null, error: { code: "40001" } }
        : original(name, args),
    );
    if (success) await runAgentWorkflow(invocation as never);
    else
      await expect(runAgentWorkflow(invocation as never)).rejects.toThrow("retention incomplete");
    const trace = rpc.mock.calls.map(([name, args]) =>
      name === "retain_catalog_surface_source" ? "retain" : args.p_action,
    );
    expect(trace).toEqual(
      success
        ? ["bind", "write", "write", "retain", "release"]
        : ["bind", "write", "write", "retain"],
    );
    expect(runAgentStep).not.toHaveBeenCalled();
    expect(persistAssistantMessageStep).not.toHaveBeenCalled();
    expect(closeChatStream).toHaveBeenCalledOnce();
  },
);
