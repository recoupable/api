import { describe, it, expect, vi, beforeEach } from "vitest";
import { autoCommitChatTurn } from "@/lib/chat/auto-commit/autoCommitChatTurn";
import { hasAutoCommitChanges } from "@/lib/chat/auto-commit/hasAutoCommitChanges";
import { runAutoCommit } from "@/lib/chat/auto-commit/runAutoCommit";
import { sendCommitChunk } from "@/lib/chat/auto-commit/sendCommitChunk";
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
  vi.clearAllMocks();
});

describe("autoCommitChatTurn", () => {
  describe("gating (canAutoCommit)", () => {
    it("skips entirely when finishReason is 'tool-calls' (intermediate turn)", async () => {
      await autoCommitChatTurn({ ...baseInput, finishReason: "tool-calls" });
      expect(hasAutoCommitChanges).not.toHaveBeenCalled();
      expect(runAutoCommit).not.toHaveBeenCalled();
      expect(sendCommitChunk).not.toHaveBeenCalled();
      expect(persistAssistantDataPart).not.toHaveBeenCalled();
    });

    it("skips entirely when repoOwner is undefined", async () => {
      await autoCommitChatTurn({ ...baseInput, repoOwner: undefined });
      expect(hasAutoCommitChanges).not.toHaveBeenCalled();
    });

    it("skips entirely when repoName is undefined", async () => {
      await autoCommitChatTurn({ ...baseInput, repoName: undefined });
      expect(hasAutoCommitChanges).not.toHaveBeenCalled();
    });

    it("skips entirely when sandboxState is undefined", async () => {
      await autoCommitChatTurn({ ...baseInput, sandboxState: undefined });
      expect(hasAutoCommitChanges).not.toHaveBeenCalled();
    });
  });

  describe("no-changes path", () => {
    it("checks for changes but emits no chunks and does not persist", async () => {
      vi.mocked(hasAutoCommitChanges).mockResolvedValue(false);
      await autoCommitChatTurn(baseInput);
      expect(hasAutoCommitChanges).toHaveBeenCalledTimes(1);
      expect(runAutoCommit).not.toHaveBeenCalled();
      expect(sendCommitChunk).not.toHaveBeenCalled();
      expect(persistAssistantDataPart).not.toHaveBeenCalled();
    });
  });

  describe("happy path", () => {
    beforeEach(() => {
      vi.mocked(hasAutoCommitChanges).mockResolvedValue(true);
      vi.mocked(runAutoCommit).mockResolvedValue({
        committed: true,
        pushed: true,
        commitSha: "abc123",
        commitMessage: "feat: thing",
      });
    });

    it("emits pending → resolved chunks and persists the resolved data-commit part", async () => {
      await autoCommitChatTurn(baseInput);

      expect(sendCommitChunk).toHaveBeenCalledTimes(2);
      expect(sendCommitChunk).toHaveBeenNthCalledWith(
        1,
        writable,
        "asst-msg-1:commit",
        expect.objectContaining({ status: "pending" }),
      );
      expect(sendCommitChunk).toHaveBeenNthCalledWith(
        2,
        writable,
        "asst-msg-1:commit",
        expect.objectContaining({
          status: "success",
          commitSha: "abc123",
          url: "https://github.com/recoupable/api/commit/abc123",
        }),
      );

      expect(persistAssistantDataPart).toHaveBeenCalledTimes(1);
      const [calledMessage, calledPart] = vi.mocked(persistAssistantDataPart).mock.calls[0]!;
      expect((calledMessage as { id: string }).id).toBe("asst-msg-1");
      expect(calledPart).toMatchObject({
        type: "data-commit",
        id: "asst-msg-1:commit",
        data: { status: "success", commitSha: "abc123" },
      });
    });

    it("forwards sessionId, sessionTitle, repos, sandboxState to runAutoCommit", async () => {
      await autoCommitChatTurn(baseInput);
      expect(runAutoCommit).toHaveBeenCalledWith({
        sessionId: "session-1",
        sessionTitle: "test",
        repoOwner: "recoupable",
        repoName: "api",
        sandboxState: baseInput.sandboxState,
      });
    });

    it("defaults sessionTitle to empty string when undefined", async () => {
      await autoCommitChatTurn({ ...baseInput, sessionTitle: undefined });
      expect(runAutoCommit).toHaveBeenCalledWith(expect.objectContaining({ sessionTitle: "" }));
    });
  });

  describe("error path (commit failed)", () => {
    it("emits resolved chunk with status='error' but does NOT skip persistence", async () => {
      vi.mocked(hasAutoCommitChanges).mockResolvedValue(true);
      vi.mocked(runAutoCommit).mockResolvedValue({
        committed: false,
        pushed: false,
        error: "Failed to stage changes",
      });

      await autoCommitChatTurn(baseInput);

      expect(sendCommitChunk).toHaveBeenNthCalledWith(
        2,
        writable,
        "asst-msg-1:commit",
        expect.objectContaining({ status: "error", error: "Failed to stage changes" }),
      );
      // We still persist the error state so the GitDataPartCard
      // renders "Commit failed" on refresh.
      expect(persistAssistantDataPart).toHaveBeenCalledTimes(1);
    });
  });
});
