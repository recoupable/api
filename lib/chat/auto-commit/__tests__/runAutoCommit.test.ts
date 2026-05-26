import { describe, it, expect, vi, beforeEach } from "vitest";
import { runAutoCommit } from "@/lib/chat/auto-commit/runAutoCommit";
import { connectSandbox } from "@/lib/sandbox/factory";
import { performAutoCommit } from "@/lib/chat/auto-commit/performAutoCommit";

vi.mock("@/lib/sandbox/factory", () => ({ connectSandbox: vi.fn() }));
vi.mock("@/lib/chat/auto-commit/performAutoCommit", () => ({
  performAutoCommit: vi.fn(),
}));

const SANDBOX_STATE = { type: "vercel", sandboxId: "sb_123" } as never;

const baseParams = {
  sessionId: "session-1",
  sessionTitle: "test",
  repoOwner: "recoupable",
  repoName: "api",
  sandboxState: SANDBOX_STATE,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runAutoCommit", () => {
  it("forwards sandbox + caller fields to performAutoCommit", async () => {
    const sandboxStub = {
      type: "vercel" as const,
      workingDirectory: "/sandbox/repo",
      exec: vi.fn(),
    } as never;
    vi.mocked(connectSandbox).mockResolvedValue(sandboxStub);
    vi.mocked(performAutoCommit).mockResolvedValue({
      committed: true,
      pushed: true,
      commitSha: "abc",
      commitMessage: "feat: thing",
    });

    const result = await runAutoCommit(baseParams);

    expect(connectSandbox).toHaveBeenCalledWith(SANDBOX_STATE);
    expect(performAutoCommit).toHaveBeenCalledWith({
      sandbox: sandboxStub,
      sessionId: "session-1",
      sessionTitle: "test",
      repoOwner: "recoupable",
      repoName: "api",
    });
    expect(result).toEqual({
      committed: true,
      pushed: true,
      commitSha: "abc",
      commitMessage: "feat: thing",
    });
  });

  it("returns the AutoCommitResult unchanged on success", async () => {
    vi.mocked(connectSandbox).mockResolvedValue({} as never);
    vi.mocked(performAutoCommit).mockResolvedValue({
      committed: false,
      pushed: false,
    });
    expect(await runAutoCommit(baseParams)).toEqual({
      committed: false,
      pushed: false,
    });
  });

  it("returns { committed:false, pushed:false, error } when connectSandbox rejects (does NOT throw)", async () => {
    vi.mocked(connectSandbox).mockRejectedValue(new Error("sandbox unreachable"));
    const result = await runAutoCommit(baseParams);
    expect(result.committed).toBe(false);
    expect(result.pushed).toBe(false);
    expect(result.error).toMatch(/sandbox unreachable|auto-commit/i);
  });

  it("returns { committed:false, pushed:false, error } when performAutoCommit rejects", async () => {
    vi.mocked(connectSandbox).mockResolvedValue({} as never);
    vi.mocked(performAutoCommit).mockRejectedValue(new Error("boom"));
    const result = await runAutoCommit(baseParams);
    expect(result.committed).toBe(false);
    expect(result.pushed).toBe(false);
    expect(result.error).toBeDefined();
  });
});
