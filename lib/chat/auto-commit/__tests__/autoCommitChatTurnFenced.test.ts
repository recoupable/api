import { it, expect, vi, beforeEach } from "vitest";
import { autoCommitChatTurn } from "@/lib/chat/auto-commit/autoCommitChatTurn";
import { hasAutoCommitChanges } from "@/lib/chat/auto-commit/hasAutoCommitChanges";
import { runAutoCommit } from "@/lib/chat/auto-commit/runAutoCommit";
import { persistAssistantDataPart } from "@/lib/chat/persistAssistantDataPart";
import type { UIMessageChunk } from "ai";

vi.mock("@/lib/chat/auto-commit/hasAutoCommitChanges", () => ({
  hasAutoCommitChanges: vi.fn(),
}));
vi.mock("@/lib/chat/auto-commit/runAutoCommit", () => ({
  runAutoCommit: vi.fn(),
}));
vi.mock("@/lib/chat/auto-commit/sendCommitChunk", () => ({
  sendCommitChunk: vi.fn(),
}));
vi.mock("@/lib/chat/persistAssistantDataPart", () => ({
  persistAssistantDataPart: vi.fn(),
}));

const writable = new WritableStream<UIMessageChunk>();
const baseMessage = {
  id: "asst-msg-1",
  role: "assistant" as const,
  parts: [{ type: "text", text: "ok" }],
};

const baseInput = {
  writable,
  responseMessage: baseMessage as never,
  finishReason: "stop",
  sessionId: "session-1",
  sessionTitle: "test",
  repoOwner: "recoupable",
  repoName: "api",
  sandboxState: { type: "vercel" as const, sandboxId: "sb_123" },
};

beforeEach(() => {
  vi.resetAllMocks();
});

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/serverClient", () => ({ default: { rpc } }));
const writer = {
  chatId: "chat",
  effectiveAccount: "11111111-1111-4111-8111-111111111111",
  epoch: 1,
  owner: "22222222-2222-4222-8222-222222222222",
  runId: "original",
};
it("requires final data-part acknowledgement without repeating commit or using legacy update", async () => {
  vi.mocked(hasAutoCommitChanges).mockResolvedValue(true);
  vi.mocked(runAutoCommit).mockResolvedValue({
    committed: true,
    pushed: true,
    commitSha: "abc",
    commitMessage: "change",
  });
  rpc.mockResolvedValue({ data: { updated: false }, error: null });
  await expect(autoCommitChatTurn(baseInput, writer)).rejects.toThrow(/reconciliation/);
  expect(runAutoCommit).toHaveBeenCalledTimes(1);
  expect(persistAssistantDataPart).not.toHaveBeenCalled();
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(rpc.mock.calls[0][1]).toMatchObject({
    p_action: "update_parts",
    p: {
      run_id: "original",
      epoch: 1,
      parts: {
        id: baseMessage.id,
        parts: [...baseMessage.parts, expect.objectContaining({ type: "data-commit" })],
      },
    },
  });
});
it("persists an error commit result with omitted optional fields and full message metadata", async () => {
  vi.mocked(hasAutoCommitChanges).mockResolvedValue(true);
  vi.mocked(runAutoCommit).mockResolvedValue({
    committed: false,
    pushed: false,
    error: "synthetic failure",
  });
  rpc.mockResolvedValue({ data: { updated: true }, error: null });
  await autoCommitChatTurn(
    {
      ...baseInput,
      responseMessage: { ...baseMessage, metadata: { trace: "preserved" } } as never,
    },
    writer,
  );
  const full = rpc.mock.calls[0][1].p.parts;
  expect(full.metadata).toEqual({ trace: "preserved" });
  expect(full.parts.at(-1).data).toEqual({
    status: "error",
    committed: false,
    pushed: false,
    error: "synthetic failure",
  });
  expect(persistAssistantDataPart).not.toHaveBeenCalled();
});
