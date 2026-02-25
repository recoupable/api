import { describe, it, expect, vi, beforeEach } from "vitest";
import { Sandbox } from "@vercel/sandbox";

import { createSandboxFromSnapshot } from "../createSandboxFromSnapshot";

const mockSelectAccountSnapshots = vi.fn();
const mockInsertAccountSandbox = vi.fn();

vi.mock("@vercel/sandbox", () => ({
  Sandbox: {
    create: vi.fn(),
  },
}));

vi.mock("ms", () => ({
  default: vi.fn((str: string) => {
    if (str === "30m") return 1800000;
    return 300000;
  }),
}));

vi.mock("@/lib/supabase/account_snapshots/selectAccountSnapshots", () => ({
  selectAccountSnapshots: (...args: unknown[]) =>
    mockSelectAccountSnapshots(...args),
}));

vi.mock("@/lib/supabase/account_sandboxes/insertAccountSandbox", () => ({
  insertAccountSandbox: (...args: unknown[]) =>
    mockInsertAccountSandbox(...args),
}));

describe("createSandboxFromSnapshot", () => {
  const mockSandbox = {
    sandboxId: "sbx_new",
    status: "running",
    timeout: 1800000,
    createdAt: new Date("2024-01-01T00:00:00Z"),
    runCommand: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Sandbox.create).mockResolvedValue(
      mockSandbox as unknown as Sandbox,
    );
    mockInsertAccountSandbox.mockResolvedValue({
      data: { account_id: "acc_1", sandbox_id: "sbx_new" },
      error: null,
    });
  });

  it("creates from snapshot when available", async () => {
    mockSelectAccountSnapshots.mockResolvedValue([
      { snapshot_id: "snap_abc", account_id: "acc_1" },
    ]);

    const result = await createSandboxFromSnapshot("acc_1");

    expect(Sandbox.create).toHaveBeenCalledWith({
      source: { type: "snapshot", snapshotId: "snap_abc" },
      timeout: 1800000,
    });
    expect(result).toBe(mockSandbox);
  });

  it("creates fresh sandbox when no snapshot exists", async () => {
    mockSelectAccountSnapshots.mockResolvedValue([]);

    const result = await createSandboxFromSnapshot("acc_1");

    expect(Sandbox.create).toHaveBeenCalledWith({
      resources: { vcpus: 4 },
      timeout: 1800000,
      runtime: "node22",
    });
    expect(result).toBe(mockSandbox);
  });

  it("inserts account_sandbox record", async () => {
    mockSelectAccountSnapshots.mockResolvedValue([]);

    await createSandboxFromSnapshot("acc_1");

    expect(mockInsertAccountSandbox).toHaveBeenCalledWith({
      account_id: "acc_1",
      sandbox_id: "sbx_new",
    });
  });

  it("returns Sandbox instance", async () => {
    mockSelectAccountSnapshots.mockResolvedValue([]);

    const result = await createSandboxFromSnapshot("acc_1");

    expect(result.sandboxId).toBe("sbx_new");
    expect(result.status).toBe("running");
  });
});
