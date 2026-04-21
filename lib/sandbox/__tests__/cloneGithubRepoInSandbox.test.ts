import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Sandbox } from "@vercel/sandbox";

import { cloneGithubRepoInSandbox } from "../cloneGithubRepoInSandbox";

describe("cloneGithubRepoInSandbox", () => {
  const mockRunCommand = vi.fn();
  const mockSandbox = {
    sandboxId: "sbx_123",
    runCommand: mockRunCommand,
  } as unknown as Sandbox;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clones the repo into /home/user using git clone", async () => {
    mockRunCommand.mockResolvedValue({ exitCode: 0 });

    await cloneGithubRepoInSandbox(mockSandbox, "https://github.com/owner/repo");

    expect(mockRunCommand).toHaveBeenCalledWith({
      cmd: "git",
      args: ["clone", "https://github.com/owner/repo", "."],
      cwd: "/home/user",
    });
  });

  it("throws when git clone fails", async () => {
    mockRunCommand.mockResolvedValue({ exitCode: 128 });

    await expect(
      cloneGithubRepoInSandbox(mockSandbox, "https://github.com/owner/repo"),
    ).rejects.toThrow("Failed to clone GitHub repo");
  });

  it("does nothing when githubRepo is null", async () => {
    await cloneGithubRepoInSandbox(mockSandbox, null);

    expect(mockRunCommand).not.toHaveBeenCalled();
  });

  it("does nothing when githubRepo is undefined", async () => {
    await cloneGithubRepoInSandbox(mockSandbox, undefined);

    expect(mockRunCommand).not.toHaveBeenCalled();
  });

  it("does nothing when githubRepo is empty string", async () => {
    await cloneGithubRepoInSandbox(mockSandbox, "");

    expect(mockRunCommand).not.toHaveBeenCalled();
  });
});
