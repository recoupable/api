import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Sandbox } from "@vercel/sandbox";

import { promptSandbox } from "../promptSandbox";

const mockGetOrCreateSandbox = vi.fn();

vi.mock("../getOrCreateSandbox", () => ({
  getOrCreateSandbox: (...args: unknown[]) => mockGetOrCreateSandbox(...args),
}));

describe("promptSandbox", () => {
  const mockRunCommand = vi.fn();
  const mockSandbox = {
    sandboxId: "sbx_123",
    status: "running",
    runCommand: mockRunCommand,
  } as unknown as Sandbox;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns stdout/stderr from successful prompt", async () => {
    mockGetOrCreateSandbox.mockResolvedValue({
      sandbox: mockSandbox,
      sandboxId: "sbx_123",
      created: false,
    });

    const mockResult = {
      stdout: vi.fn().mockResolvedValue("Hello from sandbox"),
      stderr: vi.fn().mockResolvedValue(""),
      exitCode: 0,
    };
    mockRunCommand.mockResolvedValue(mockResult);

    const result = await promptSandbox({
      accountId: "acc_1",
      apiKey: "key_abc",
      prompt: "say hello",
    });

    expect(result).toEqual({
      sandboxId: "sbx_123",
      stdout: "Hello from sandbox",
      stderr: "",
      exitCode: 0,
      created: false,
    });
  });

  it("passes caller's API key as RECOUP_API_KEY env var", async () => {
    mockGetOrCreateSandbox.mockResolvedValue({
      sandbox: mockSandbox,
      sandboxId: "sbx_123",
      created: false,
    });

    const mockResult = {
      stdout: vi.fn().mockResolvedValue(""),
      stderr: vi.fn().mockResolvedValue(""),
      exitCode: 0,
    };
    mockRunCommand.mockResolvedValue(mockResult);

    await promptSandbox({
      accountId: "acc_1",
      apiKey: "caller-api-key",
      prompt: "do something",
    });

    expect(mockRunCommand).toHaveBeenCalledWith({
      cmd: "openclaw",
      args: ["agent", "--agent", "main", "--message", "do something"],
      env: {
        RECOUP_API_KEY: "caller-api-key",
        RECOUP_ACCOUNT_ID: "acc_1",
      },
    });
  });

  it("reports created=true when sandbox was newly created", async () => {
    mockGetOrCreateSandbox.mockResolvedValue({
      sandbox: mockSandbox,
      sandboxId: "sbx_new",
      created: true,
    });

    const mockResult = {
      stdout: vi.fn().mockResolvedValue("setup done"),
      stderr: vi.fn().mockResolvedValue(""),
      exitCode: 0,
    };
    mockRunCommand.mockResolvedValue(mockResult);

    const result = await promptSandbox({
      accountId: "acc_1",
      apiKey: "key_abc",
      prompt: "setup",
    });

    expect(result.created).toBe(true);
    expect(result.sandboxId).toBe("sbx_new");
  });

  it("handles non-zero exit code", async () => {
    mockGetOrCreateSandbox.mockResolvedValue({
      sandbox: mockSandbox,
      sandboxId: "sbx_123",
      created: false,
    });

    const mockResult = {
      stdout: vi.fn().mockResolvedValue(""),
      stderr: vi.fn().mockResolvedValue("command not found"),
      exitCode: 127,
    };
    mockRunCommand.mockResolvedValue(mockResult);

    const result = await promptSandbox({
      accountId: "acc_1",
      apiKey: "key_abc",
      prompt: "bad command",
    });

    expect(result).toEqual({
      sandboxId: "sbx_123",
      stdout: "",
      stderr: "command not found",
      exitCode: 127,
      created: false,
    });
  });
});
