import { describe, it, expect, vi, beforeEach } from "vitest";
import { hasAutoCommitChanges } from "@/lib/chat/auto-commit/hasAutoCommitChanges";
import { connectSandbox } from "@/lib/sandbox/factory";

vi.mock("@/lib/sandbox/factory", () => ({
  connectSandbox: vi.fn(),
}));

function buildSandbox(execResult: { success: boolean; stdout: string; stderr?: string }) {
  return {
    type: "vercel" as const,
    workingDirectory: "/sandbox/repo",
    exec: vi.fn().mockResolvedValue({
      success: execResult.success,
      stdout: execResult.stdout,
      stderr: execResult.stderr ?? "",
      exitCode: execResult.success ? 0 : 1,
      truncated: false,
    }),
  } as never;
}

const SANDBOX_STATE = { type: "vercel" as const, sandboxId: "sb_123" } as never;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("hasAutoCommitChanges", () => {
  it("returns true when git status --porcelain has output (changes present)", async () => {
    vi.mocked(connectSandbox).mockResolvedValue(
      buildSandbox({ success: true, stdout: "M file.txt\n" }),
    );
    expect(await hasAutoCommitChanges({ sandboxState: SANDBOX_STATE })).toBe(true);
  });

  it("returns false when git status --porcelain has empty output (no changes)", async () => {
    vi.mocked(connectSandbox).mockResolvedValue(buildSandbox({ success: true, stdout: "" }));
    expect(await hasAutoCommitChanges({ sandboxState: SANDBOX_STATE })).toBe(false);
  });

  it("returns false when git status --porcelain has only whitespace", async () => {
    vi.mocked(connectSandbox).mockResolvedValue(buildSandbox({ success: true, stdout: "   \n\n" }));
    expect(await hasAutoCommitChanges({ sandboxState: SANDBOX_STATE })).toBe(false);
  });

  it("returns true (fail-open) when git status itself fails — lets runAutoCommit surface the real error", async () => {
    vi.mocked(connectSandbox).mockResolvedValue(
      buildSandbox({ success: false, stdout: "", stderr: "not a git repo" }),
    );
    expect(await hasAutoCommitChanges({ sandboxState: SANDBOX_STATE })).toBe(true);
  });

  it("returns true (fail-open) when the sandbox connect rejects — same rationale", async () => {
    vi.mocked(connectSandbox).mockRejectedValue(new Error("sandbox gone"));
    expect(await hasAutoCommitChanges({ sandboxState: SANDBOX_STATE })).toBe(true);
  });
});
