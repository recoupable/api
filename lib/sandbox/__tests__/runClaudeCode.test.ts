import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Sandbox } from "@vercel/sandbox";
import { runClaudeCode } from "../runClaudeCode";

describe("runClaudeCode", () => {
  const mockSandbox = {
    writeFiles: vi.fn(),
    runCommand: vi.fn(),
  } as unknown as Sandbox;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mockSandbox.writeFiles).mockResolvedValue(undefined);
    vi.mocked(mockSandbox.runCommand).mockResolvedValue({ exitCode: 0 } as never);
  });

  it("writes script file with claude command and prompt", async () => {
    const prompt = "create a hello world app";
    await runClaudeCode(mockSandbox, prompt);

    expect(mockSandbox.writeFiles).toHaveBeenCalledWith([
      {
        path: "/vercel/sandbox/ralph-once.sh",
        content: Buffer.from(`claude --permission-mode acceptEdits --model opus '${prompt}'`),
      },
    ]);
  });

  it("executes script with sh command", async () => {
    await runClaudeCode(mockSandbox, "test prompt");

    expect(mockSandbox.runCommand).toHaveBeenCalledWith({
      cmd: "sh",
      args: ["ralph-once.sh"],
      stdout: process.stdout,
      stderr: process.stderr,
      env: {
        ANTHROPIC_API_KEY: expect.any(String),
      },
    });
  });

  it("uses ANTHROPIC_API_KEY from environment", async () => {
    process.env.ANTHROPIC_API_KEY = "test-api-key-123";
    await runClaudeCode(mockSandbox, "test prompt");

    expect(mockSandbox.runCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        env: {
          ANTHROPIC_API_KEY: "test-api-key-123",
        },
      }),
    );
  });

  it("uses empty string if ANTHROPIC_API_KEY is not set", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await runClaudeCode(mockSandbox, "test prompt");

    expect(mockSandbox.runCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        env: {
          ANTHROPIC_API_KEY: "",
        },
      }),
    );
  });

  it("escapes single quotes in prompt", async () => {
    const prompt = "create a 'hello' world app";
    await runClaudeCode(mockSandbox, prompt);

    expect(mockSandbox.writeFiles).toHaveBeenCalledWith([
      {
        path: "/vercel/sandbox/ralph-once.sh",
        content: Buffer.from(`claude --permission-mode acceptEdits --model opus '${prompt}'`),
      },
    ]);
  });

  it("handles multi-line prompts", async () => {
    const prompt = "line 1\nline 2\nline 3";
    await runClaudeCode(mockSandbox, prompt);

    expect(mockSandbox.writeFiles).toHaveBeenCalledWith([
      {
        path: "/vercel/sandbox/ralph-once.sh",
        content: Buffer.from(`claude --permission-mode acceptEdits --model opus '${prompt}'`),
      },
    ]);
  });
});
