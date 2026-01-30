import { describe, it, expect, vi, beforeEach } from "vitest";

import { createSandbox } from "../createSandbox";
import { Sandbox } from "@vercel/sandbox";

const mockSandbox = {
  sandboxId: "sbx_test123",
  runCommand: vi.fn(),
  writeFiles: vi.fn(),
  stop: vi.fn(),
};

vi.mock("@vercel/sandbox", () => ({
  Sandbox: {
    create: vi.fn(() => Promise.resolve(mockSandbox)),
  },
}));

vi.mock("ms", () => ({
  default: vi.fn((str: string) => {
    if (str === "10m") return 600000;
    return 300000;
  }),
}));

describe("createSandbox", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.clearAllMocks();
    mockSandbox.runCommand.mockResolvedValue({ exitCode: 0 });
    mockSandbox.writeFiles.mockResolvedValue(undefined);
    mockSandbox.stop.mockResolvedValue(undefined);
  });

  it("creates sandbox with correct configuration", async () => {
    await createSandbox("console.log('test')");

    expect(Sandbox.create).toHaveBeenCalledWith({
      resources: { vcpus: 4 },
      timeout: 600000,
      runtime: "node22",
    });
  });

  it("installs Claude Code CLI globally with sudo", async () => {
    await createSandbox("console.log('test')");

    expect(mockSandbox.runCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        cmd: "npm",
        args: ["install", "-g", "@anthropic-ai/claude-code"],
        sudo: true,
      }),
    );
  });

  it("installs Anthropic SDK", async () => {
    await createSandbox("console.log('test')");

    expect(mockSandbox.runCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        cmd: "npm",
        args: ["install", "@anthropic-ai/sdk"],
      }),
    );
  });

  it("writes script to sandbox filesystem", async () => {
    const script = "console.log('hello')";
    await createSandbox(script);

    expect(mockSandbox.writeFiles).toHaveBeenCalledWith([
      {
        path: "/vercel/sandbox/script.mjs",
        content: Buffer.from(script),
      },
    ]);
  });

  it("executes script with ANTHROPIC_API_KEY env var", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    await createSandbox("console.log('test')");

    expect(mockSandbox.runCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        cmd: "node",
        args: ["script.mjs"],
        env: { ANTHROPIC_API_KEY: "test-key" },
      }),
    );
  });

  it("returns sandbox result with output and exitCode", async () => {
    const result = await createSandbox("console.log('test')");

    expect(result).toEqual({
      sandboxId: "sbx_test123",
      output: expect.any(String),
      exitCode: 0,
    });
  });

  it("stops sandbox after execution", async () => {
    await createSandbox("console.log('test')");

    expect(mockSandbox.stop).toHaveBeenCalled();
  });

  it("stops sandbox even if script execution fails", async () => {
    mockSandbox.runCommand
      .mockResolvedValueOnce({ exitCode: 0 }) // CLI install
      .mockResolvedValueOnce({ exitCode: 0 }) // SDK install
      .mockResolvedValueOnce({ exitCode: 1 }); // script fails

    const result = await createSandbox("console.log('test')");

    expect(result.exitCode).toBe(1);
    expect(mockSandbox.stop).toHaveBeenCalled();
  });

  it("throws error if Claude Code CLI installation fails", async () => {
    mockSandbox.runCommand.mockResolvedValueOnce({ exitCode: 1 });

    await expect(createSandbox("console.log('test')")).rejects.toThrow(
      "Failed to install Claude Code CLI",
    );
    expect(mockSandbox.stop).toHaveBeenCalled();
  });

  it("throws error if Anthropic SDK installation fails", async () => {
    mockSandbox.runCommand
      .mockResolvedValueOnce({ exitCode: 0 }) // CLI install succeeds
      .mockResolvedValueOnce({ exitCode: 1 }); // SDK install fails

    await expect(createSandbox("console.log('test')")).rejects.toThrow(
      "Failed to install Anthropic SDK",
    );
    expect(mockSandbox.stop).toHaveBeenCalled();
  });
});
