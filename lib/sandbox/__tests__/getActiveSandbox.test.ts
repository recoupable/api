import { describe, it, expect, vi, beforeEach } from "vitest";
import { Sandbox } from "@vercel/sandbox";

import { getActiveSandbox } from "../getActiveSandbox";

const mockSelectAccountSandboxes = vi.fn();

vi.mock("@vercel/sandbox", () => ({
  Sandbox: {
    get: vi.fn(),
  },
}));

vi.mock("@/lib/supabase/account_sandboxes/selectAccountSandboxes", () => ({
  selectAccountSandboxes: (...args: unknown[]) => mockSelectAccountSandboxes(...args),
}));

describe("getActiveSandbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns sandbox when most recent is running", async () => {
    mockSelectAccountSandboxes.mockResolvedValue([{ sandbox_id: "sbx_123", account_id: "acc_1" }]);

    const mockSandbox = {
      name: "sbx_123",
      status: "running",
      runCommand: vi.fn(),
    };
    vi.mocked(Sandbox.get).mockResolvedValue(mockSandbox as unknown as Sandbox);

    const result = await getActiveSandbox("acc_1");

    expect(mockSelectAccountSandboxes).toHaveBeenCalledWith({
      accountIds: ["acc_1"],
    });
    expect(Sandbox.get).toHaveBeenCalledWith({ name: "sbx_123" });
    expect(result).toBe(mockSandbox);
  });

  it("returns null when no sandboxes exist", async () => {
    mockSelectAccountSandboxes.mockResolvedValue([]);

    const result = await getActiveSandbox("acc_1");

    expect(result).toBeNull();
    expect(Sandbox.get).not.toHaveBeenCalled();
  });

  it("returns null when sandbox is not running", async () => {
    mockSelectAccountSandboxes.mockResolvedValue([
      { sandbox_id: "sbx_stopped", account_id: "acc_1" },
    ]);

    const mockSandbox = {
      name: "sbx_stopped",
      status: "stopped",
    };
    vi.mocked(Sandbox.get).mockResolvedValue(mockSandbox as unknown as Sandbox);

    const result = await getActiveSandbox("acc_1");

    expect(result).toBeNull();
  });

  it("returns null when Sandbox.get throws", async () => {
    mockSelectAccountSandboxes.mockResolvedValue([
      { sandbox_id: "sbx_expired", account_id: "acc_1" },
    ]);

    vi.mocked(Sandbox.get).mockRejectedValue(new Error("Sandbox not found"));

    const result = await getActiveSandbox("acc_1");

    expect(result).toBeNull();
  });
});
