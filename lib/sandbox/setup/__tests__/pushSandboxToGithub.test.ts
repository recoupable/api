import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Sandbox } from "@vercel/sandbox";

import { pushSandboxToGithub } from "../pushSandboxToGithub";
import type { SetupDeps } from "../types";

const mockRunGitCommand = vi.fn();
const mockRunOpenClawAgent = vi.fn();

vi.mock("../helpers", () => ({
  runGitCommand: (...args: unknown[]) => mockRunGitCommand(...args),
  runOpenClawAgent: (...args: unknown[]) => mockRunOpenClawAgent(...args),
}));

describe("pushSandboxToGithub", () => {
  const mockRunCommand = vi.fn();
  const mockSandbox = {
    sandboxId: "sbx_123",
    runCommand: mockRunCommand,
  } as unknown as Sandbox;
  const deps: SetupDeps = {
    log: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("GITHUB_TOKEN", "test-token");
    mockRunGitCommand.mockResolvedValue(true);
    mockRunOpenClawAgent.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });
  });

  it("configures git user, copies openclaw, stages, commits, and pushes", async () => {
    // diff --cached --quiet returns non-zero (changes exist)
    mockRunCommand
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: vi.fn().mockResolvedValue("/root"),
      }) // pushOrgRepos: echo ~
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: vi.fn().mockResolvedValue(""),
      }) // pushOrgRepos: find org repos
      .mockResolvedValueOnce({ exitCode: 0 }) // copyOpenClawToRepo
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: vi.fn().mockResolvedValue("/root"),
      }) // addOrgSubmodules: echo ~
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: vi.fn().mockResolvedValue(""),
      }) // addOrgSubmodules: find orgs
      .mockResolvedValueOnce({ exitCode: 0 }) // stripGitmodulesTokens
      .mockResolvedValueOnce({ exitCode: 1 }) // diff --cached (has changes)
      .mockResolvedValueOnce({ exitCode: 0 }); // rebase --abort

    const result = await pushSandboxToGithub(mockSandbox, deps);

    expect(result).toBe(true);

    // git config user.email
    expect(mockRunGitCommand).toHaveBeenCalledWith(
      mockSandbox,
      ["config", "user.email", "agent@recoupable.com"],
      expect.any(String),
      deps,
    );

    // git config user.name
    expect(mockRunGitCommand).toHaveBeenCalledWith(
      mockSandbox,
      ["config", "user.name", "Recoup Agent"],
      expect.any(String),
      deps,
    );

    // git add -A
    expect(mockRunGitCommand).toHaveBeenCalledWith(
      mockSandbox,
      ["add", "-A"],
      expect.any(String),
      deps,
    );

    // git commit
    expect(mockRunGitCommand).toHaveBeenCalledWith(
      mockSandbox,
      ["commit", "-m", "Update sandbox files"],
      expect.any(String),
      deps,
    );

    // git push --force
    expect(mockRunGitCommand).toHaveBeenCalledWith(
      mockSandbox,
      ["push", "--force", "origin", "HEAD:main"],
      expect.any(String),
      deps,
    );
  });

  it("skips commit when no changes", async () => {
    // diff --cached --quiet returns 0 (no changes)
    mockRunCommand
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: vi.fn().mockResolvedValue("/root"),
      }) // pushOrgRepos: echo ~
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: vi.fn().mockResolvedValue(""),
      }) // pushOrgRepos: find
      .mockResolvedValueOnce({ exitCode: 0 }) // copyOpenClawToRepo
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: vi.fn().mockResolvedValue("/root"),
      }) // addOrgSubmodules: echo ~
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: vi.fn().mockResolvedValue(""),
      }) // addOrgSubmodules: find orgs
      .mockResolvedValueOnce({ exitCode: 0 }) // stripGitmodulesTokens
      .mockResolvedValueOnce({ exitCode: 0 }) // diff --cached (no changes)
      .mockResolvedValueOnce({ exitCode: 0 }); // rebase --abort

    const result = await pushSandboxToGithub(mockSandbox, deps);

    expect(result).toBe(true);
    expect(mockRunGitCommand).not.toHaveBeenCalledWith(
      mockSandbox,
      ["commit", "-m", "Update sandbox files"],
      expect.any(String),
      deps,
    );
  });

  it("returns false when git config fails", async () => {
    mockRunGitCommand.mockResolvedValueOnce(false); // config email fails

    const result = await pushSandboxToGithub(mockSandbox, deps);

    expect(result).toBe(false);
  });
});
