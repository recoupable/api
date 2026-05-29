import { describe, it, expect, vi, beforeEach } from "vitest";
import { performAutoCommit } from "@/lib/chat/auto-commit/performAutoCommit";
import generateText from "@/lib/ai/generateText";
import { getServiceGithubToken } from "@/lib/github/getServiceGithubToken";
import type { ExecResult, Sandbox } from "@/lib/sandbox/abstraction";

vi.mock("@/lib/ai/generateText", () => ({ default: vi.fn() }));
vi.mock("@/lib/github/getServiceGithubToken", () => ({
  getServiceGithubToken: vi.fn(),
}));

const ok = (stdout = "", stderr = ""): ExecResult => ({
  success: true,
  exitCode: 0,
  stdout,
  stderr,
  truncated: false,
});

const fail = (stdout = "", stderr = ""): ExecResult => ({
  success: false,
  exitCode: 1,
  stdout,
  stderr,
  truncated: false,
});

function makeSandbox(handlers: Record<string, ExecResult> = {}) {
  const exec = vi.fn((cmd: string) => {
    for (const [pattern, result] of Object.entries(handlers)) {
      if (cmd.includes(pattern)) return Promise.resolve(result);
    }
    return Promise.resolve(ok());
  });
  const sandbox = {
    type: "vercel" as const,
    workingDirectory: "/sandbox/repo",
    exec,
  } as unknown as Sandbox;
  return { sandbox, exec };
}

const baseParams = {
  sessionId: "session-1",
  sessionTitle: "test session",
  repoOwner: "recoupable",
  repoName: "api",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getServiceGithubToken).mockReturnValue(undefined);
  vi.mocked(generateText).mockResolvedValue({
    text: "feat: add example file",
  } as never);
});

describe("performAutoCommit", () => {
  describe("no changes path", () => {
    it("returns { committed:false, pushed:false } when git status is empty", async () => {
      const { sandbox, exec } = makeSandbox({
        "git status --porcelain": ok(""),
      });
      const result = await performAutoCommit({ sandbox, ...baseParams });
      expect(result).toEqual({ committed: false, pushed: false });
      // Should not have called add/commit/push when nothing to stage
      expect(exec).not.toHaveBeenCalledWith(
        expect.stringContaining("git add -A"),
        expect.any(String),
        expect.any(Number),
      );
    });

    it("returns { committed:false, pushed:false } when git status itself fails", async () => {
      const { sandbox } = makeSandbox({
        "git status --porcelain": fail("not a git repo"),
      });
      const result = await performAutoCommit({ sandbox, ...baseParams });
      expect(result).toEqual({ committed: false, pushed: false });
    });
  });

  describe("happy path", () => {
    it("commits AND pushes when changes are present", async () => {
      const { sandbox, exec } = makeSandbox({
        "git status --porcelain": ok("M file.txt"),
        "git diff --cached": ok("diff content"),
        "git rev-parse HEAD": ok("abc123def456"),
        "git symbolic-ref --short HEAD": ok("feat/branch"),
      });
      const result = await performAutoCommit({ sandbox, ...baseParams });

      expect(result.committed).toBe(true);
      expect(result.pushed).toBe(true);
      expect(result.commitMessage).toBe("feat: add example file");
      expect(result.commitSha).toBe("abc123def456");
      expect(result.error).toBeUndefined();

      // Verify command sequence by call ordering
      const calls = exec.mock.calls.map(c => c[0]);
      const addIdx = calls.findIndex(c => c.includes("git add -A"));
      const commitIdx = calls.findIndex(c => c.startsWith("git commit"));
      const pushIdx = calls.findIndex(c => c.includes("git push"));
      expect(addIdx).toBeGreaterThanOrEqual(0);
      expect(commitIdx).toBeGreaterThan(addIdx);
      expect(pushIdx).toBeGreaterThan(commitIdx);
    });

    it("pushes the current branch via `git push -u origin <branch>`", async () => {
      const { sandbox, exec } = makeSandbox({
        "git status --porcelain": ok("M file.txt"),
        "git diff --cached": ok("diff"),
        "git rev-parse HEAD": ok("sha"),
        "git symbolic-ref --short HEAD": ok("custom-branch"),
      });
      await performAutoCommit({ sandbox, ...baseParams });
      expect(exec).toHaveBeenCalledWith(
        expect.stringContaining("git push -u origin custom-branch"),
        expect.any(String),
        expect.any(Number),
      );
    });

    it("disables interactive prompts on push (GIT_TERMINAL_PROMPT=0)", async () => {
      const { sandbox, exec } = makeSandbox({
        "git status --porcelain": ok("M file.txt"),
        "git diff --cached": ok("diff"),
        "git rev-parse HEAD": ok("sha"),
        "git symbolic-ref --short HEAD": ok("main"),
      });
      await performAutoCommit({ sandbox, ...baseParams });
      const pushCall = exec.mock.calls.find(c => c[0].includes("git push"));
      expect(pushCall?.[0]).toContain("GIT_TERMINAL_PROMPT=0");
    });
  });

  describe("error paths", () => {
    it("returns { committed:false, pushed:false, error } when git add fails", async () => {
      const { sandbox } = makeSandbox({
        "git status --porcelain": ok("M file.txt"),
        "git add -A": fail("permission denied"),
      });
      const result = await performAutoCommit({ sandbox, ...baseParams });
      expect(result.committed).toBe(false);
      expect(result.pushed).toBe(false);
      expect(result.error).toMatch(/stage|add/i);
    });

    it("returns { committed:false, pushed:false, error } when git commit fails", async () => {
      const { sandbox } = makeSandbox({
        "git status --porcelain": ok("M file.txt"),
        "git diff --cached": ok("diff"),
        "git commit": fail("nothing to commit"),
      });
      const result = await performAutoCommit({ sandbox, ...baseParams });
      expect(result.committed).toBe(false);
      expect(result.pushed).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("returns { committed:true, pushed:false, error } when push fails after commit succeeds", async () => {
      const { sandbox } = makeSandbox({
        "git status --porcelain": ok("M file.txt"),
        "git diff --cached": ok("diff"),
        "git rev-parse HEAD": ok("commitsha"),
        "git symbolic-ref --short HEAD": ok("main"),
        "git push": fail("network unreachable"),
      });
      const result = await performAutoCommit({ sandbox, ...baseParams });
      expect(result.committed).toBe(true);
      expect(result.pushed).toBe(false);
      expect(result.commitSha).toBe("commitsha");
      expect(result.error).toMatch(/push/i);
    });
  });

  describe("commit message generation", () => {
    it("uses the LLM-generated commit message on success", async () => {
      vi.mocked(generateText).mockResolvedValue({
        text: "fix: update header logic",
      } as never);
      const { sandbox } = makeSandbox({
        "git status --porcelain": ok("M file.txt"),
        "git diff --cached": ok("diff"),
        "git rev-parse HEAD": ok("sha"),
        "git symbolic-ref --short HEAD": ok("main"),
      });
      const result = await performAutoCommit({ sandbox, ...baseParams });
      expect(result.commitMessage).toBe("fix: update header logic");
    });

    it("falls back to default message when generateText rejects", async () => {
      vi.mocked(generateText).mockRejectedValue(new Error("gateway down"));
      const { sandbox } = makeSandbox({
        "git status --porcelain": ok("M file.txt"),
        "git diff --cached": ok("diff"),
        "git rev-parse HEAD": ok("sha"),
        "git symbolic-ref --short HEAD": ok("main"),
      });
      const result = await performAutoCommit({ sandbox, ...baseParams });
      expect(result.committed).toBe(true);
      expect(result.commitMessage).toBe("chore: update repository changes");
    });

    it("falls back to default message when staged diff is empty (rare race)", async () => {
      const { sandbox } = makeSandbox({
        "git status --porcelain": ok("M file.txt"),
        "git diff --cached": ok(""), // empty diff
        "git rev-parse HEAD": ok("sha"),
        "git symbolic-ref --short HEAD": ok("main"),
      });
      const result = await performAutoCommit({ sandbox, ...baseParams });
      expect(result.commitMessage).toBe("chore: update repository changes");
      expect(generateText).not.toHaveBeenCalled();
    });

    it("truncates the LLM-generated message to 72 chars", async () => {
      const longMessage = "feat: " + "x".repeat(200);
      vi.mocked(generateText).mockResolvedValue({ text: longMessage } as never);
      const { sandbox } = makeSandbox({
        "git status --porcelain": ok("M file.txt"),
        "git diff --cached": ok("diff"),
        "git rev-parse HEAD": ok("sha"),
        "git symbolic-ref --short HEAD": ok("main"),
      });
      const result = await performAutoCommit({ sandbox, ...baseParams });
      expect(result.commitMessage!.length).toBeLessThanOrEqual(72);
    });
  });

  describe("github auth url", () => {
    it("sets `git remote set-url origin` with x-access-token URL when GITHUB_TOKEN is set", async () => {
      vi.mocked(getServiceGithubToken).mockReturnValue("ghp_test_token_value");
      const { sandbox, exec } = makeSandbox({
        "git status --porcelain": ok("M file.txt"),
        "git diff --cached": ok("diff"),
        "git rev-parse HEAD": ok("sha"),
        "git symbolic-ref --short HEAD": ok("main"),
      });
      await performAutoCommit({ sandbox, ...baseParams });
      const remoteCall = exec.mock.calls.find(c => c[0].includes("git remote set-url"));
      expect(remoteCall?.[0]).toContain("x-access-token:ghp_test_token_value");
      expect(remoteCall?.[0]).toContain("github.com/recoupable/api");
    });

    it("does NOT touch the remote when GITHUB_TOKEN is missing", async () => {
      vi.mocked(getServiceGithubToken).mockReturnValue(undefined);
      const { sandbox, exec } = makeSandbox({
        "git status --porcelain": ok("M file.txt"),
        "git diff --cached": ok("diff"),
        "git rev-parse HEAD": ok("sha"),
        "git symbolic-ref --short HEAD": ok("main"),
      });
      await performAutoCommit({ sandbox, ...baseParams });
      const remoteCall = exec.mock.calls.find(c => c[0].includes("git remote set-url"));
      expect(remoteCall).toBeUndefined();
    });
  });
});
