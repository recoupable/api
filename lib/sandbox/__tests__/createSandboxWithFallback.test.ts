import { describe, it, expect, vi, beforeEach } from "vitest";

import { createSandboxWithFallback } from "../createSandboxWithFallback";

const mockCreateSandbox = vi.fn();

vi.mock("@/lib/sandbox/createSandbox", () => ({
  createSandbox: (...args: unknown[]) => mockCreateSandbox(...args),
}));

const mockSandbox = { sandboxId: "sbx_123", status: "running" };
const mockResponse = {
  sandboxId: "sbx_123",
  sandboxStatus: "running",
  timeout: 1800000,
  createdAt: "2024-01-01T00:00:00.000Z",
};
const mockCreateResult = { sandbox: mockSandbox, response: mockResponse };

describe("createSandboxWithFallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateSandbox.mockResolvedValue(mockCreateResult);
  });

  it("creates from snapshot when snapshotId is provided", async () => {
    const result = await createSandboxWithFallback("snap_abc");

    expect(mockCreateSandbox).toHaveBeenCalledWith({
      source: { type: "snapshot", snapshotId: "snap_abc" },
    });
    expect(result).toEqual({ ...mockCreateResult, fromSnapshot: true });
  });

  it("creates fresh sandbox when snapshotId is undefined", async () => {
    const result = await createSandboxWithFallback(undefined);

    expect(mockCreateSandbox).toHaveBeenCalledWith({});
    expect(result).toEqual({ ...mockCreateResult, fromSnapshot: false });
  });

  it("falls back to fresh sandbox when snapshot creation fails", async () => {
    const freshSandbox = { sandboxId: "sbx_fresh", status: "running" };
    const freshResponse = { ...mockResponse, sandboxId: "sbx_fresh" };
    const freshResult = { sandbox: freshSandbox, response: freshResponse };
    mockCreateSandbox
      .mockRejectedValueOnce(new Error("Status code 400 is not ok"))
      .mockResolvedValueOnce(freshResult);

    const result = await createSandboxWithFallback("snap_bad");

    expect(mockCreateSandbox).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ ...freshResult, fromSnapshot: false });
  });

  it("logs error when snapshot creation fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const snapshotError = new Error("Status code 400 is not ok");
    mockCreateSandbox.mockRejectedValueOnce(snapshotError).mockResolvedValueOnce(mockCreateResult);

    await createSandboxWithFallback("snap_bad");

    expect(consoleSpy).toHaveBeenCalledWith(
      "Snapshot sandbox creation failed, falling back to fresh sandbox:",
      snapshotError,
    );
    consoleSpy.mockRestore();
  });
});
