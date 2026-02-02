import { describe, it, expect, vi, beforeEach } from "vitest";

import { createSandbox } from "../createSandbox";
import { Sandbox } from "@vercel/sandbox";

const mockSandbox = {
  sandboxId: "sbx_test123",
  status: "running",
  timeout: 600000,
  createdAt: new Date("2024-01-01T00:00:00Z"),
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
    vi.clearAllMocks();
  });

  it("creates sandbox with correct configuration", async () => {
    await createSandbox();

    expect(Sandbox.create).toHaveBeenCalledWith({
      resources: { vcpus: 4 },
      timeout: 600000,
      runtime: "node22",
    });
  });

  it("returns sandbox created response with sandboxStatus", async () => {
    const result = await createSandbox();

    expect(result).toEqual({
      sandboxId: "sbx_test123",
      sandboxStatus: "running",
      timeout: 600000,
      createdAt: "2024-01-01T00:00:00.000Z",
    });
  });

  it("does not stop sandbox after creation", async () => {
    const mockSandboxWithStop = {
      ...mockSandbox,
      stop: vi.fn(),
    };
    vi.mocked(Sandbox.create).mockResolvedValue(mockSandboxWithStop as unknown as Sandbox);

    await createSandbox();

    expect(mockSandboxWithStop.stop).not.toHaveBeenCalled();
  });
});
