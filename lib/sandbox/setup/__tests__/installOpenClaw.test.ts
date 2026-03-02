import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Sandbox } from "@vercel/sandbox";

import { installOpenClaw } from "../installOpenClaw";
import type { SetupDeps } from "../types";

describe("installOpenClaw", () => {
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
  });

  it("skips installation when openclaw is already installed", async () => {
    mockRunCommand.mockResolvedValue({ exitCode: 0 });

    await installOpenClaw(mockSandbox, deps);

    expect(mockRunCommand).toHaveBeenCalledTimes(1);
    expect(mockRunCommand).toHaveBeenCalledWith({
      cmd: "which",
      args: ["openclaw"],
    });
    expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("already installed"));
  });

  it("installs openclaw when not present", async () => {
    mockRunCommand
      .mockResolvedValueOnce({ exitCode: 1 }) // which openclaw fails
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: vi.fn().mockResolvedValue(""),
        stderr: vi.fn().mockResolvedValue(""),
      }); // npm install succeeds

    await installOpenClaw(mockSandbox, deps);

    expect(mockRunCommand).toHaveBeenCalledWith({
      cmd: "npm",
      args: ["install", "-g", "openclaw@latest"],
      sudo: true,
    });
  });

  it("throws when installation fails", async () => {
    mockRunCommand
      .mockResolvedValueOnce({ exitCode: 1 }) // which openclaw fails
      .mockResolvedValueOnce({
        exitCode: 1,
        stdout: vi.fn().mockResolvedValue(""),
        stderr: vi.fn().mockResolvedValue("install error"),
      }); // npm install fails

    await expect(installOpenClaw(mockSandbox, deps)).rejects.toThrow(
      "Failed to install OpenClaw CLI",
    );
  });
});
