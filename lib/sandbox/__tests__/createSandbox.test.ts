import { describe, it, expect, vi, beforeEach } from "vitest";

import { createSandbox } from "../createSandbox";
import { Sandbox } from "@vercel/sandbox";
import { installClaudeCode } from "../installClaudeCode";
import { runClaudeCode } from "../runClaudeCode";

const mockSandbox = {
  sandboxId: "sbx_test123",
  status: "running",
  timeout: 600000,
  createdAt: new Date("2024-01-01T00:00:00Z"),
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

vi.mock("../installClaudeCode", () => ({
  installClaudeCode: vi.fn(),
}));

vi.mock("../runClaudeCode", () => ({
  runClaudeCode: vi.fn(),
}));

describe("createSandbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(installClaudeCode).mockResolvedValue(undefined);
    vi.mocked(runClaudeCode).mockResolvedValue(undefined);
    mockSandbox.runCommand.mockResolvedValue({ exitCode: 0 });
    mockSandbox.writeFiles.mockResolvedValue(undefined);
    mockSandbox.stop.mockResolvedValue(undefined);
  });

  it("creates sandbox with correct configuration", async () => {
    await createSandbox("tell me hello");

    expect(Sandbox.create).toHaveBeenCalledWith({
      resources: { vcpus: 4 },
      timeout: 600000,
      runtime: "node22",
    });
  });

  it("calls installClaudeCode", async () => {
    await createSandbox("tell me hello");

    expect(installClaudeCode).toHaveBeenCalledWith(mockSandbox);
  });

  it("calls runClaudeCode with sandbox and prompt", async () => {
    const prompt = "tell me hello";
    await createSandbox(prompt);

    expect(runClaudeCode).toHaveBeenCalledWith(mockSandbox, prompt);
  });

  it("returns sandbox created response with sandboxStatus", async () => {
    const result = await createSandbox("tell me hello");

    expect(result).toEqual({
      sandboxId: "sbx_test123",
      sandboxStatus: "running",
      timeout: 600000,
      createdAt: "2024-01-01T00:00:00.000Z",
    });
  });

  it("stops sandbox after execution", async () => {
    await createSandbox("tell me hello");

    expect(mockSandbox.stop).toHaveBeenCalled();
  });

  it("stops sandbox if runClaudeCode fails", async () => {
    vi.mocked(runClaudeCode).mockRejectedValue(new Error("Failed to run claude code"));

    await expect(createSandbox("tell me hello")).rejects.toThrow("Failed to run claude code");
    expect(mockSandbox.stop).toHaveBeenCalled();
  });

  it("stops sandbox if installClaudeCode fails", async () => {
    vi.mocked(installClaudeCode).mockRejectedValue(new Error("Failed to install"));

    await expect(createSandbox("tell me hello")).rejects.toThrow("Failed to install");
    expect(mockSandbox.stop).toHaveBeenCalled();
  });
});
