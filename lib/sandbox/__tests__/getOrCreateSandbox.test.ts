import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Sandbox } from "@vercel/sandbox";

import { getOrCreateSandbox } from "../getOrCreateSandbox";

const mockGetActiveSandbox = vi.fn();
const mockCreateSandboxFromSnapshot = vi.fn();

vi.mock("../getActiveSandbox", () => ({
  getActiveSandbox: (...args: unknown[]) => mockGetActiveSandbox(...args),
}));

vi.mock("../createSandboxFromSnapshot", () => ({
  createSandboxFromSnapshot: (...args: unknown[]) =>
    mockCreateSandboxFromSnapshot(...args),
}));

describe("getOrCreateSandbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns existing sandbox with created=false", async () => {
    const mockSandbox = {
      sandboxId: "sbx_existing",
      status: "running",
    } as unknown as Sandbox;

    mockGetActiveSandbox.mockResolvedValue(mockSandbox);

    const result = await getOrCreateSandbox("acc_1");

    expect(result).toEqual({
      sandbox: mockSandbox,
      sandboxId: "sbx_existing",
      created: false,
    });
    expect(mockCreateSandboxFromSnapshot).not.toHaveBeenCalled();
  });

  it("creates new sandbox when none active with created=true", async () => {
    const mockSandbox = {
      sandboxId: "sbx_new",
      status: "running",
    } as unknown as Sandbox;

    mockGetActiveSandbox.mockResolvedValue(null);
    mockCreateSandboxFromSnapshot.mockResolvedValue(mockSandbox);

    const result = await getOrCreateSandbox("acc_1");

    expect(result).toEqual({
      sandbox: mockSandbox,
      sandboxId: "sbx_new",
      created: true,
    });
    expect(mockCreateSandboxFromSnapshot).toHaveBeenCalledWith("acc_1");
  });
});
