import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Sandbox } from "@vercel/sandbox";

import { createSandboxFromSnapshot } from "../createSandboxFromSnapshot";

const mockSelectAccountSnapshots = vi.fn();
const mockInsertAccountSandbox = vi.fn();
const mockCreateSandbox = vi.fn();

vi.mock("@/lib/sandbox/createSandbox", () => ({
  createSandbox: (...args: unknown[]) => mockCreateSandbox(...args),
}));

vi.mock("@/lib/supabase/account_snapshots/selectAccountSnapshots", () => ({
  selectAccountSnapshots: (...args: unknown[]) => mockSelectAccountSnapshots(...args),
}));

vi.mock("@/lib/supabase/account_sandboxes/insertAccountSandbox", () => ({
  insertAccountSandbox: (...args: unknown[]) => mockInsertAccountSandbox(...args),
}));

describe("createSandboxFromSnapshot", () => {
  const mockSandbox = {
    sandboxId: "sbx_new",
    status: "running",
    runCommand: vi.fn(),
  } as unknown as Sandbox;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateSandbox.mockResolvedValue({
      sandbox: mockSandbox,
      response: {
        sandboxId: "sbx_new",
        sandboxStatus: "running",
        timeout: 1800000,
        createdAt: "2024-01-01T00:00:00.000Z",
      },
    });
    mockInsertAccountSandbox.mockResolvedValue({
      data: { account_id: "acc_1", sandbox_id: "sbx_new" },
      error: null,
    });
  });

  it("creates from snapshot when available", async () => {
    mockSelectAccountSnapshots.mockResolvedValue([
      { snapshot_id: "snap_abc", account_id: "acc_1" },
    ]);

    await createSandboxFromSnapshot("acc_1");

    expect(mockCreateSandbox).toHaveBeenCalledWith({
      source: { type: "snapshot", snapshotId: "snap_abc" },
    });
  });

  it("creates fresh sandbox when no snapshot exists", async () => {
    mockSelectAccountSnapshots.mockResolvedValue([]);

    await createSandboxFromSnapshot("acc_1");

    expect(mockCreateSandbox).toHaveBeenCalledWith({});
  });

  it("inserts account_sandbox record", async () => {
    mockSelectAccountSnapshots.mockResolvedValue([]);

    await createSandboxFromSnapshot("acc_1");

    expect(mockInsertAccountSandbox).toHaveBeenCalledWith({
      account_id: "acc_1",
      sandbox_id: "sbx_new",
    });
  });

  it("returns { sandbox, fromSnapshot: false } when no snapshot exists", async () => {
    mockSelectAccountSnapshots.mockResolvedValue([]);

    const result = await createSandboxFromSnapshot("acc_1");

    expect(result).toEqual({
      sandbox: mockSandbox,
      fromSnapshot: false,
    });
  });

  it("returns { sandbox, fromSnapshot: true } when snapshot exists", async () => {
    mockSelectAccountSnapshots.mockResolvedValue([
      { snapshot_id: "snap_abc", account_id: "acc_1" },
    ]);

    const result = await createSandboxFromSnapshot("acc_1");

    expect(result).toEqual({
      sandbox: mockSandbox,
      fromSnapshot: true,
    });
  });
});
