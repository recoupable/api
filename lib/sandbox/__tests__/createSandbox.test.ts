import { describe, it, expect, vi, beforeEach } from "vitest";

import { createSandbox } from "../createSandbox";
import { Sandbox, APIError } from "@vercel/sandbox";

const mockSandbox = {
  sandboxId: "sbx_test123",
  status: "running",
  timeout: 1800000,
  createdAt: new Date("2024-01-01T00:00:00Z"),
};

vi.mock("@vercel/sandbox", async () => {
  const actual = await vi.importActual("@vercel/sandbox");
  return {
    ...actual,
    Sandbox: {
      create: vi.fn(() => Promise.resolve(mockSandbox)),
    },
  };
});

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

  it("creates sandbox from snapshot when source is provided", async () => {
    await createSandbox({ source: { type: "snapshot", snapshotId: "snap_abc123" } });

    expect(Sandbox.create).toHaveBeenCalledWith({
      source: { type: "snapshot", snapshotId: "snap_abc123" },
      timeout: 1800000,
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

  it("re-throws APIError with detailed message including API response json", async () => {
    const fakeResponse = new Response("Bad Request", { status: 400, statusText: "Bad Request" });
    const apiError = new APIError(fakeResponse, {
      message: "Status code 400 is not ok",
      json: { error: { code: "bad_request", message: "vcpus must be between 0.5 and 2" } },
      text: '{"error":{"code":"bad_request","message":"vcpus must be between 0.5 and 2"}}',
    });
    vi.mocked(Sandbox.create).mockRejectedValue(apiError);

    await expect(createSandbox()).rejects.toThrow("vcpus must be between 0.5 and 2");
  });

  it("logs API error details to console.error", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fakeResponse = new Response("Bad Request", { status: 400, statusText: "Bad Request" });
    const apiError = new APIError(fakeResponse, {
      message: "Status code 400 is not ok",
      json: { error: { code: "bad_request", message: "quota exceeded" } },
      text: '{"error":{"code":"bad_request","message":"quota exceeded"}}',
    });
    vi.mocked(Sandbox.create).mockRejectedValue(apiError);

    await expect(createSandbox()).rejects.toThrow();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Sandbox.create failed"),
      expect.objectContaining({ json: apiError.json }),
    );
    consoleSpy.mockRestore();
  });

  it("re-throws non-APIError errors unchanged", async () => {
    const genericError = new Error("Network timeout");
    vi.mocked(Sandbox.create).mockRejectedValue(genericError);

    await expect(createSandbox()).rejects.toThrow("Network timeout");
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
