import { describe, it, expect, vi, beforeEach } from "vitest";
import { Sandbox } from "@vercel/sandbox";

import { getSandboxStatus } from "../getSandboxStatus";

vi.mock("@vercel/sandbox", () => ({
  Sandbox: {
    get: vi.fn(),
  },
}));

describe("getSandboxStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns sandbox status when sandbox exists", async () => {
    const mockSandbox = {
      sandboxId: "sbx_123",
      status: "running",
      timeout: 600000,
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
    };
    vi.mocked(Sandbox.get).mockResolvedValue(mockSandbox as unknown as Sandbox);

    const result = await getSandboxStatus("sbx_123");

    expect(Sandbox.get).toHaveBeenCalledWith({ sandboxId: "sbx_123" });
    expect(result).toEqual({
      sandboxId: "sbx_123",
      sandboxStatus: "running",
      timeout: 600000,
      createdAt: "2024-01-01T00:00:00.000Z",
    });
  });

  it("returns null when sandbox is not found", async () => {
    vi.mocked(Sandbox.get).mockRejectedValue(new Error("Sandbox not found"));

    const result = await getSandboxStatus("sbx_nonexistent");

    expect(result).toBeNull();
  });

  it("returns null on API error", async () => {
    vi.mocked(Sandbox.get).mockRejectedValue(new Error("API error"));

    const result = await getSandboxStatus("sbx_123");

    expect(result).toBeNull();
  });

  it("handles stopped sandbox status", async () => {
    const mockSandbox = {
      sandboxId: "sbx_stopped",
      status: "stopped",
      timeout: 0,
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
    };
    vi.mocked(Sandbox.get).mockResolvedValue(mockSandbox as unknown as Sandbox);

    const result = await getSandboxStatus("sbx_stopped");

    expect(result).toEqual({
      sandboxId: "sbx_stopped",
      sandboxStatus: "stopped",
      timeout: 0,
      createdAt: "2024-01-01T00:00:00.000Z",
    });
  });

  it("handles pending sandbox status", async () => {
    const mockSandbox = {
      sandboxId: "sbx_pending",
      status: "pending",
      timeout: 600000,
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
    };
    vi.mocked(Sandbox.get).mockResolvedValue(mockSandbox as unknown as Sandbox);

    const result = await getSandboxStatus("sbx_pending");

    expect(result?.sandboxStatus).toBe("pending");
  });
});
