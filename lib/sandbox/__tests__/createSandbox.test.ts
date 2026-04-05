import { describe, it, expect, vi, beforeEach } from "vitest";

import { createSandbox } from "../createSandbox";
import { Sandbox } from "@vercel/sandbox";

const mockSandbox = {
  name: "sbx_test123",
  status: "running",
  timeout: 1800000,
  createdAt: new Date("2024-01-01T00:00:00Z"),
};

vi.mock("@vercel/sandbox", () => ({
  Sandbox: {
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

  it("creates sandbox with default configuration when no params provided", async () => {
    await createSandbox();

    expect(Sandbox.create).toHaveBeenCalledWith({
      resources: { vcpus: 4 },
      timeout: 1800000,
      runtime: "node22",
    });
  });

  it("creates sandbox with name when provided", async () => {
    await createSandbox({ name: "acc_123" });

    expect(Sandbox.create).toHaveBeenCalledWith({
      resources: { vcpus: 4 },
      timeout: 1800000,
      runtime: "node22",
      name: "acc_123",
    });
  });

  it("allows overriding default timeout", async () => {
    await createSandbox({ timeout: 300000 });

    expect(Sandbox.create).toHaveBeenCalledWith({
      resources: { vcpus: 4 },
      timeout: 300000,
      runtime: "node22",
    });
  });

  it("allows overriding default resources", async () => {
    await createSandbox({ resources: { vcpus: 2 } });

    expect(Sandbox.create).toHaveBeenCalledWith({
      resources: { vcpus: 2 },
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
    vi.mocked(Sandbox.create).mockResolvedValue(mockSandboxWithStop as unknown as Sandbox);

    await createSandbox();

    expect(mockSandboxWithStop.stop).not.toHaveBeenCalled();
  });
});
