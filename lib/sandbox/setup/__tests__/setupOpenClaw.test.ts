import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Sandbox } from "@vercel/sandbox";

import { setupOpenClaw } from "../setupOpenClaw";
import type { SetupDeps } from "../types";

describe("setupOpenClaw", () => {
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
    vi.stubEnv("AI_GATEWAY_API_KEY", "test-gateway-key");
    vi.stubEnv("RECOUP_API_KEY", "test-api-key");
    vi.stubEnv("GITHUB_TOKEN", "test-github-token");
  });

  it("skips onboard when config exists, still injects env and starts gateway", async () => {
    mockRunCommand
      .mockResolvedValueOnce({ exitCode: 0 }) // config check - exists
      .mockResolvedValueOnce({ exitCode: 0, stderr: vi.fn().mockResolvedValue("") }) // inject env
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: vi.fn().mockResolvedValue(""),
        stderr: vi.fn().mockResolvedValue(""),
      }); // gateway

    await setupOpenClaw(mockSandbox, "acc_1", "api-key-123", deps);

    // Should check config, skip onboard, inject env, start gateway
    expect(mockRunCommand).toHaveBeenCalledTimes(3);
  });

  it("runs onboard when config does not exist", async () => {
    mockRunCommand
      .mockResolvedValueOnce({ exitCode: 1 }) // config check - missing
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: vi.fn().mockResolvedValue(""),
        stderr: vi.fn().mockResolvedValue(""),
      }) // onboard
      .mockResolvedValueOnce({ exitCode: 0, stderr: vi.fn().mockResolvedValue("") }) // inject env
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: vi.fn().mockResolvedValue(""),
        stderr: vi.fn().mockResolvedValue(""),
      }); // gateway

    await setupOpenClaw(mockSandbox, "acc_1", "api-key-123", deps);

    expect(mockRunCommand).toHaveBeenCalledWith({
      cmd: "openclaw",
      args: expect.arrayContaining(["onboard", "--non-interactive"]),
    });
  });

  it("injects RECOUP_API_KEY and RECOUP_ACCOUNT_ID into openclaw.json", async () => {
    mockRunCommand
      .mockResolvedValueOnce({ exitCode: 0 }) // config check - exists
      .mockResolvedValueOnce({ exitCode: 0, stderr: vi.fn().mockResolvedValue("") }) // inject env
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: vi.fn().mockResolvedValue(""),
        stderr: vi.fn().mockResolvedValue(""),
      }); // gateway

    await setupOpenClaw(mockSandbox, "acc_1", "api-key-123", deps);

    const injectCall = mockRunCommand.mock.calls[1];
    const shellScript = injectCall[0].args[1];
    expect(shellScript).toContain("api-key-123");
    expect(shellScript).toContain("acc_1");
  });

  it("starts gateway in background", async () => {
    mockRunCommand
      .mockResolvedValueOnce({ exitCode: 0 }) // config check
      .mockResolvedValueOnce({ exitCode: 0, stderr: vi.fn().mockResolvedValue("") }) // inject env
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: vi.fn().mockResolvedValue(""),
        stderr: vi.fn().mockResolvedValue(""),
      }); // gateway

    await setupOpenClaw(mockSandbox, "acc_1", "api-key-123", deps);

    const gatewayCall = mockRunCommand.mock.calls[2];
    expect(gatewayCall[0].args[1]).toContain("openclaw gateway run");
  });

  it("throws when AI_GATEWAY_API_KEY is missing", async () => {
    vi.stubEnv("AI_GATEWAY_API_KEY", "");
    delete process.env.AI_GATEWAY_API_KEY;

    mockRunCommand.mockResolvedValueOnce({ exitCode: 1 }); // config check - missing

    await expect(setupOpenClaw(mockSandbox, "acc_1", "api-key-123", deps)).rejects.toThrow(
      "Missing AI_GATEWAY_API_KEY environment variable",
    );
  });

  it("throws when env injection fails", async () => {
    mockRunCommand
      .mockResolvedValueOnce({ exitCode: 0 }) // config check
      .mockResolvedValueOnce({
        exitCode: 1,
        stderr: vi.fn().mockResolvedValue("node error"),
      }); // inject env fails

    await expect(setupOpenClaw(mockSandbox, "acc_1", "api-key-123", deps)).rejects.toThrow(
      "Failed to inject env vars",
    );
  });

  it("throws when gateway start fails", async () => {
    mockRunCommand
      .mockResolvedValueOnce({ exitCode: 0 }) // config check
      .mockResolvedValueOnce({ exitCode: 0, stderr: vi.fn().mockResolvedValue("") }) // inject env
      .mockResolvedValueOnce({
        exitCode: 1,
        stdout: vi.fn().mockResolvedValue(""),
        stderr: vi.fn().mockResolvedValue("gateway error"),
      }); // gateway fails

    await expect(setupOpenClaw(mockSandbox, "acc_1", "api-key-123", deps)).rejects.toThrow(
      "Failed to start OpenClaw gateway",
    );
  });
});
