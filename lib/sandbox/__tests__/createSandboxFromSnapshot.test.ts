import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Sandbox } from "@vercel/sandbox";

import { createSandboxFromSnapshot } from "../createSandboxFromSnapshot";

const mockGetValidSnapshotId = vi.fn();
const mockInsertAccountSandbox = vi.fn();
const mockCreateSandbox = vi.fn();

vi.mock("@/lib/sandbox/createSandbox", () => ({
  createSandbox: (...args: unknown[]) => mockCreateSandbox(...args),
}));

vi.mock("@/lib/sandbox/getValidSnapshotId", () => ({
  getValidSnapshotId: (...args: unknown[]) => mockGetValidSnapshotId(...args),
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
    mockGetValidSnapshotId.mockResolvedValue("snap_abc");

    await createSandboxFromSnapshot("acc_1");

    expect(mockCreateSandbox).toHaveBeenCalledWith({
      source: { type: "snapshot", snapshotId: "snap_abc" },
    });
  });

  it("creates fresh sandbox when no snapshot exists", async () => {
    mockGetValidSnapshotId.mockResolvedValue(undefined);

    await createSandboxFromSnapshot("acc_1");

    expect(mockCreateSandbox).toHaveBeenCalledWith({});
  });

  it("inserts account_sandbox record", async () => {
    mockGetValidSnapshotId.mockResolvedValue(undefined);

    await createSandboxFromSnapshot("acc_1");

    expect(mockInsertAccountSandbox).toHaveBeenCalledWith({
      account_id: "acc_1",
      sandbox_id: "sbx_new",
    });
  });

  it("returns { sandbox, fromSnapshot: true } when snapshot exists", async () => {
    mockGetValidSnapshotId.mockResolvedValue("snap_abc");

    const result = await createSandboxFromSnapshot("acc_1");

    expect(result).toEqual({ sandbox: mockSandbox, fromSnapshot: true });
  });

  it("returns { sandbox, fromSnapshot: false } when no snapshot", async () => {
    mockGetValidSnapshotId.mockResolvedValue(undefined);

    const result = await createSandboxFromSnapshot("acc_1");

    expect(result).toEqual({ sandbox: mockSandbox, fromSnapshot: false });
  });

  it("skips expired snapshot (getValidSnapshotId returns undefined)", async () => {
    mockGetValidSnapshotId.mockResolvedValue(undefined);

    const result = await createSandboxFromSnapshot("acc_1");

    expect(mockCreateSandbox).toHaveBeenCalledWith({});
    expect(result).toEqual({ sandbox: mockSandbox, fromSnapshot: false });
  });

  it("falls back to fresh sandbox when snapshot creation fails", async () => {
    mockGetValidSnapshotId.mockResolvedValue("snap_bad");

    const freshSandbox = {
      sandboxId: "sbx_fresh",
      status: "running",
      runCommand: vi.fn(),
    } as unknown as Sandbox;

    mockCreateSandbox
      .mockRejectedValueOnce(new Error("Status code 400 is not ok"))
      .mockResolvedValueOnce({
        sandbox: freshSandbox,
        response: {
          sandboxId: "sbx_fresh",
          sandboxStatus: "running",
          timeout: 1800000,
          createdAt: "2024-01-01T00:00:00.000Z",
        },
      });

    const result = await createSandboxFromSnapshot("acc_1");

    expect(mockCreateSandbox).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ sandbox: freshSandbox, fromSnapshot: false });
  });
});
