import { describe, it, expect, vi, beforeEach } from "vitest";

import { createSandbox } from "../createSandbox";
import { VercelSandbox } from "../vercel";

const mockSandbox = {
  name: "sbx_test123",
  sdkStatus: "running",
  timeout: 1800000,
  createdAt: new Date("2024-01-01T00:00:00Z"),
};

vi.mock("../vercel", () => ({
  VercelSandbox: {
    create: vi.fn(() => Promise.resolve(mockSandbox)),
  },
}));

vi.mock("ms", () => ({
  default: vi.fn((str: string) => {
    if (str === "30m") return 1800000;
    return 300000;
  }),
}));

describe("createSandbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates sandbox with default configuration when no config provided", async () => {
    await createSandbox();

    expect(VercelSandbox.create).toHaveBeenCalledWith({
      vcpus: 4,
      timeout: 1800000,
      runtime: "node22",
    });
  });

  it("restores from snapshot when restoreSnapshotId is provided", async () => {
    await createSandbox({ restoreSnapshotId: "snap_abc123" });

    expect(VercelSandbox.create).toHaveBeenCalledWith({
      restoreSnapshotId: "snap_abc123",
      timeout: 1800000,
    });
  });

  it("allows overriding default timeout", async () => {
    await createSandbox({ timeout: 300000 });

    expect(VercelSandbox.create).toHaveBeenCalledWith({
      vcpus: 4,
      timeout: 300000,
      runtime: "node22",
    });
  });

  it("allows overriding default vcpus", async () => {
    await createSandbox({ vcpus: 2 });

    expect(VercelSandbox.create).toHaveBeenCalledWith({
      vcpus: 2,
      timeout: 1800000,
      runtime: "node22",
    });
  });

  it("returns sandbox instance and response separately", async () => {
    const result = await createSandbox();

    expect(result.sandbox).toBe(mockSandbox);
    expect(result.response).toEqual({
      sandboxId: "sbx_test123",
      sandboxStatus: "running",
      timeout: 1800000,
      createdAt: "2024-01-01T00:00:00.000Z",
    });
  });

  it("does not stop sandbox after creation", async () => {
    const mockSandboxWithStop = {
      ...mockSandbox,
      stop: vi.fn(),
    };
    vi.mocked(VercelSandbox.create).mockResolvedValue(
      mockSandboxWithStop as unknown as VercelSandbox,
    );

    await createSandbox();

    expect(mockSandboxWithStop.stop).not.toHaveBeenCalled();
  });
});
