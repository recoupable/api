import { describe, it, expect, vi, beforeEach } from "vitest";
import { VercelSandbox } from "@/lib/sandbox/vercel";

import { getActiveSandbox } from "../getActiveSandbox";

const mockSelectAccountSandboxes = vi.fn();

vi.mock("@/lib/sandbox/vercel", () => ({
  VercelSandbox: {
    connect: vi.fn(),
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
      sdkStatus: "running",
    };
    vi.mocked(VercelSandbox.connect).mockResolvedValue(mockSandbox as unknown as VercelSandbox);

    const result = await getActiveSandbox("acc_1");

    expect(mockSelectAccountSandboxes).toHaveBeenCalledWith({
      accountIds: ["acc_1"],
    });
    expect(VercelSandbox.connect).toHaveBeenCalledWith("sbx_123", {});
    expect(result).toBe(mockSandbox);
  });

  it("returns null when no sandboxes exist", async () => {
    mockSelectAccountSandboxes.mockResolvedValue([]);

    const result = await getActiveSandbox("acc_1");

    expect(result).toBeNull();
    expect(VercelSandbox.connect).not.toHaveBeenCalled();
  });

  it("returns null when sandbox is not running", async () => {
    mockSelectAccountSandboxes.mockResolvedValue([
      { sandbox_id: "sbx_stopped", account_id: "acc_1" },
    ]);

    const mockSandbox = {
      name: "sbx_stopped",
      sdkStatus: "stopped",
    };
    vi.mocked(VercelSandbox.connect).mockResolvedValue(mockSandbox as unknown as VercelSandbox);

    const result = await getActiveSandbox("acc_1");

    expect(result).toBeNull();
  });

  it("returns null when VercelSandbox.connect throws", async () => {
    mockSelectAccountSandboxes.mockResolvedValue([
      { sandbox_id: "sbx_expired", account_id: "acc_1" },
    ]);

    vi.mocked(VercelSandbox.connect).mockRejectedValue(new Error("Sandbox not found"));

    const result = await getActiveSandbox("acc_1");

    expect(result).toBeNull();
  });
});
