import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Sandbox } from "@vercel/sandbox";

import { runGitCommand, runOpenClawAgent, installSkill } from "../helpers";
import type { SetupDeps } from "../types";

describe("helpers", () => {
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

  describe("runGitCommand", () => {
    it("returns true on success", async () => {
      mockRunCommand.mockResolvedValue({
        exitCode: 0,
        stdout: vi.fn().mockResolvedValue(""),
        stderr: vi.fn().mockResolvedValue(""),
      });

      const result = await runGitCommand(mockSandbox, ["status"], "check status", deps);

      expect(result).toBe(true);
      expect(mockRunCommand).toHaveBeenCalledWith({ cmd: "git", args: ["status"] });
    });

    it("returns false and logs on failure", async () => {
      mockRunCommand.mockResolvedValue({
        exitCode: 1,
        stdout: vi.fn().mockResolvedValue(""),
        stderr: vi.fn().mockResolvedValue("fatal: not a git repo"),
      });

      const result = await runGitCommand(mockSandbox, ["status"], "check status", deps);

      expect(result).toBe(false);
      expect(deps.error).toHaveBeenCalledWith(
        "Failed to check status",
        expect.objectContaining({ exitCode: 1 }),
      );
    });
  });

  describe("runOpenClawAgent", () => {
    it("runs openclaw agent with correct args", async () => {
      mockRunCommand.mockResolvedValue({
        exitCode: 0,
        stdout: vi.fn().mockResolvedValue("done"),
        stderr: vi.fn().mockResolvedValue(""),
      });

      const result = await runOpenClawAgent(
        mockSandbox,
        {
          label: "Test run",
          message: "do something",
        },
        deps,
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("done");
      expect(mockRunCommand).toHaveBeenCalledWith({
        cmd: "openclaw",
        args: ["agent", "--agent", "main", "--message", "do something"],
      });
    });

    it("passes env vars when provided", async () => {
      mockRunCommand.mockResolvedValue({
        exitCode: 0,
        stdout: vi.fn().mockResolvedValue(""),
        stderr: vi.fn().mockResolvedValue(""),
      });

      await runOpenClawAgent(
        mockSandbox,
        {
          label: "Test",
          message: "test",
          env: { MY_VAR: "value" },
        },
        deps,
      );

      expect(mockRunCommand).toHaveBeenCalledWith({
        cmd: "openclaw",
        args: ["agent", "--agent", "main", "--message", "test"],
        env: { MY_VAR: "value" },
      });
    });

    it("logs error on non-zero exit", async () => {
      mockRunCommand.mockResolvedValue({
        exitCode: 1,
        stdout: vi.fn().mockResolvedValue(""),
        stderr: vi.fn().mockResolvedValue("error msg"),
      });

      const result = await runOpenClawAgent(
        mockSandbox,
        {
          label: "Failing",
          message: "bad",
        },
        deps,
      );

      expect(result.exitCode).toBe(1);
      expect(deps.error).toHaveBeenCalledWith(
        "Failing failed",
        expect.objectContaining({ stderr: "error msg" }),
      );
    });
  });

  describe("installSkill", () => {
    it("installs via npx and copies to openclaw workspace", async () => {
      mockRunCommand
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: vi.fn().mockResolvedValue("installed"),
          stderr: vi.fn().mockResolvedValue(""),
        })
        .mockResolvedValueOnce({
          exitCode: 0,
          stderr: vi.fn().mockResolvedValue(""),
        });

      await installSkill(mockSandbox, "recoupable/setup-sandbox", deps);

      expect(mockRunCommand).toHaveBeenCalledWith({
        cmd: "npx",
        args: ["skills", "add", "recoupable/setup-sandbox", "-y"],
      });
      expect(mockRunCommand).toHaveBeenCalledWith({
        cmd: "sh",
        args: [
          "-c",
          "mkdir -p ~/.openclaw/workspace/skills && rm -rf ~/.openclaw/workspace/skills/setup-sandbox && cp -r .agents/skills/setup-sandbox ~/.openclaw/workspace/skills/setup-sandbox",
        ],
      });
    });

    it("throws on install failure", async () => {
      mockRunCommand.mockResolvedValueOnce({
        exitCode: 1,
        stdout: vi.fn().mockResolvedValue(""),
        stderr: vi.fn().mockResolvedValue("install failed"),
      });

      await expect(installSkill(mockSandbox, "recoupable/setup-sandbox", deps)).rejects.toThrow(
        "Failed to install skill recoupable/setup-sandbox",
      );
    });

    it("throws on copy failure", async () => {
      mockRunCommand
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: vi.fn().mockResolvedValue(""),
          stderr: vi.fn().mockResolvedValue(""),
        })
        .mockResolvedValueOnce({
          exitCode: 1,
          stderr: vi.fn().mockResolvedValue("cp failed"),
        });

      await expect(installSkill(mockSandbox, "recoupable/setup-sandbox", deps)).rejects.toThrow(
        "Failed to copy skill setup-sandbox",
      );
    });
  });
});
