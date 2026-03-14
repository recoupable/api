import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Sandbox } from "@vercel/sandbox";
import { installClaudeCode } from "../installClaudeCode";

describe("installClaudeCode", () => {
  const mockSandbox = {
    runCommand: vi.fn(),
  } as unknown as Sandbox;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mockSandbox.runCommand).mockResolvedValue({ exitCode: 0 } as never);
  });

  it("installs Claude Code CLI globally with sudo", async () => {
    await installClaudeCode(mockSandbox);

    expect(mockSandbox.runCommand).toHaveBeenCalledWith({
      cmd: "npm",
      args: ["install", "-g", "@anthropic-ai/claude-code"],
      stderr: process.stderr,
      stdout: process.stdout,
      sudo: true,
    });
  });

  it("installs Anthropic SDK", async () => {
    await installClaudeCode(mockSandbox);

    expect(mockSandbox.runCommand).toHaveBeenCalledWith({
      cmd: "npm",
      args: ["install", "@anthropic-ai/sdk"],
      stderr: process.stderr,
      stdout: process.stdout,
    });
  });

  it("throws error if CLI installation fails", async () => {
    vi.mocked(mockSandbox.runCommand).mockResolvedValue({ exitCode: 1 } as never);

    await expect(installClaudeCode(mockSandbox)).rejects.toThrow(
      "Failed to install Claude Code CLI",
    );
  });

  it("throws error if SDK installation fails", async () => {
    vi.mocked(mockSandbox.runCommand)
      .mockResolvedValueOnce({ exitCode: 0 } as never)
      .mockResolvedValueOnce({ exitCode: 1 } as never);

    await expect(installClaudeCode(mockSandbox)).rejects.toThrow("Failed to install Anthropic SDK");
  });
});
