import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Sandbox } from "@vercel/sandbox";

import { promptSandboxStreaming } from "../promptSandboxStreaming";

const mockGetOrCreateSandbox = vi.fn();

vi.mock("../getOrCreateSandbox", () => ({
  getOrCreateSandbox: (...args: unknown[]) => mockGetOrCreateSandbox(...args),
}));

describe("promptSandboxStreaming", () => {
  const mockRunCommand = vi.fn();
  const mockSandbox = {
    sandboxId: "sbx_123",
    status: "running",
    runCommand: mockRunCommand,
  } as unknown as Sandbox;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("yields log chunks in order and returns final result", async () => {
    mockGetOrCreateSandbox.mockResolvedValue({
      sandbox: mockSandbox,
      sandboxId: "sbx_123",
      created: false,
    });

    async function* fakeLogs() {
      yield { data: "Hello ", stream: "stdout" as const };
      yield { data: "world", stream: "stdout" as const };
    }

    const mockCmd = {
      logs: () => fakeLogs(),
      wait: vi.fn().mockResolvedValue({ exitCode: 0 }),
    };
    mockRunCommand.mockResolvedValue(mockCmd);

    const chunks: Array<{ data: string; stream: "stdout" | "stderr" }> = [];
    let finalResult;

    const gen = promptSandboxStreaming({
      accountId: "acc_1",
      apiKey: "key_abc",
      prompt: "say hello",
    });

    while (true) {
      const result = await gen.next();
      if (result.done) {
        finalResult = result.value;
        break;
      }
      chunks.push(
        result.value as { data: string; stream: "stdout" | "stderr" },
      );
    }

    expect(chunks).toEqual([
      { data: "Hello ", stream: "stdout" },
      { data: "world", stream: "stdout" },
    ]);

    expect(finalResult).toEqual({
      sandboxId: "sbx_123",
      stdout: "Hello world",
      stderr: "",
      exitCode: 0,
      created: false,
    });
  });

  it("accumulates stderr separately", async () => {
    mockGetOrCreateSandbox.mockResolvedValue({
      sandbox: mockSandbox,
      sandboxId: "sbx_123",
      created: false,
    });

    async function* fakeLogs() {
      yield { data: "output", stream: "stdout" as const };
      yield { data: "warn: something", stream: "stderr" as const };
    }

    const mockCmd = {
      logs: () => fakeLogs(),
      wait: vi.fn().mockResolvedValue({ exitCode: 0 }),
    };
    mockRunCommand.mockResolvedValue(mockCmd);

    let finalResult;

    const gen = promptSandboxStreaming({
      accountId: "acc_1",
      apiKey: "key_abc",
      prompt: "test",
    });

    while (true) {
      const result = await gen.next();
      if (result.done) {
        finalResult = result.value;
        break;
      }
    }

    expect(finalResult).toEqual({
      sandboxId: "sbx_123",
      stdout: "output",
      stderr: "warn: something",
      exitCode: 0,
      created: false,
    });
  });

  it("uses detached mode with runCommand", async () => {
    mockGetOrCreateSandbox.mockResolvedValue({
      sandbox: mockSandbox,
      sandboxId: "sbx_123",
      created: false,
    });

    async function* fakeLogs() {
      yield { data: "done", stream: "stdout" as const };
    }

    const mockCmd = {
      logs: () => fakeLogs(),
      wait: vi.fn().mockResolvedValue({ exitCode: 0 }),
    };
    mockRunCommand.mockResolvedValue(mockCmd);

    const gen = promptSandboxStreaming({
      accountId: "acc_1",
      apiKey: "key_abc",
      prompt: "run",
    });

    // Drain the generator
    for await (const _ of gen) {
      // consume
    }

    expect(mockRunCommand).toHaveBeenCalledWith({
      cmd: "openclaw",
      args: ["agent", "--agent", "main", "--message", "run"],
      env: { RECOUP_API_KEY: "key_abc" },
      detached: true,
    });
  });

  it("reports created=true when sandbox was newly created", async () => {
    mockGetOrCreateSandbox.mockResolvedValue({
      sandbox: mockSandbox,
      sandboxId: "sbx_new",
      created: true,
    });

    async function* fakeLogs() {
      yield { data: "setup done", stream: "stdout" as const };
    }

    const mockCmd = {
      logs: () => fakeLogs(),
      wait: vi.fn().mockResolvedValue({ exitCode: 0 }),
    };
    mockRunCommand.mockResolvedValue(mockCmd);

    const gen = promptSandboxStreaming({
      accountId: "acc_1",
      apiKey: "key_abc",
      prompt: "setup",
    });

    let finalResult;
    while (true) {
      const result = await gen.next();
      if (result.done) {
        finalResult = result.value;
        break;
      }
    }

    expect(finalResult!.created).toBe(true);
    expect(finalResult!.sandboxId).toBe("sbx_new");
  });

  it("handles non-zero exit code", async () => {
    mockGetOrCreateSandbox.mockResolvedValue({
      sandbox: mockSandbox,
      sandboxId: "sbx_123",
      created: false,
    });

    async function* fakeLogs() {
      yield { data: "error output", stream: "stderr" as const };
    }

    const mockCmd = {
      logs: () => fakeLogs(),
      wait: vi.fn().mockResolvedValue({ exitCode: 1 }),
    };
    mockRunCommand.mockResolvedValue(mockCmd);

    const gen = promptSandboxStreaming({
      accountId: "acc_1",
      apiKey: "key_abc",
      prompt: "bad command",
    });

    let finalResult;
    while (true) {
      const result = await gen.next();
      if (result.done) {
        finalResult = result.value;
        break;
      }
    }

    expect(finalResult).toEqual({
      sandboxId: "sbx_123",
      stdout: "",
      stderr: "error output",
      exitCode: 1,
      created: false,
    });
  });
});
