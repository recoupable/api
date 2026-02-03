import { describe, it, expect, vi, beforeEach } from "vitest";

import { upsertAccountSnapshot } from "../upsertAccountSnapshot";

const mockFrom = vi.fn();
const mockUpsert = vi.fn();
const mockSelect = vi.fn();
const mockSingle = vi.fn();

vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

describe("upsertAccountSnapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ upsert: mockUpsert });
    mockUpsert.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ single: mockSingle });
  });

  it("upserts an account snapshot record and returns data on success", async () => {
    const mockData = {
      account_id: "account-456",
      snapshot_id: "snap_abc123",
      expires_at: "2024-12-31T23:59:59.000Z",
      created_at: "2024-01-01T00:00:00.000Z",
    };
    mockSingle.mockResolvedValue({ data: mockData, error: null });

    const result = await upsertAccountSnapshot({
      accountId: "account-456",
      snapshotId: "snap_abc123",
    });

    expect(mockFrom).toHaveBeenCalledWith("account_snapshots");
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        account_id: "account-456",
        snapshot_id: "snap_abc123",
      }),
      { onConflict: "account_id" },
    );
    expect(result).toEqual({ data: mockData, error: null });
  });

  it("returns data when updating existing snapshot", async () => {
    const mockData = {
      account_id: "account-456",
      snapshot_id: "snap_new789",
      expires_at: "2024-12-31T23:59:59.000Z",
      created_at: "2024-01-01T00:00:00.000Z",
    };
    mockSingle.mockResolvedValue({ data: mockData, error: null });

    const result = await upsertAccountSnapshot({
      accountId: "account-456",
      snapshotId: "snap_new789",
    });

    expect(mockFrom).toHaveBeenCalledWith("account_snapshots");
    expect(result).toEqual({ data: mockData, error: null });
  });

  it("returns error when upsert fails", async () => {
    const mockError = { message: "Upsert failed", code: "23505" };
    mockSingle.mockResolvedValue({ data: null, error: mockError });

    const result = await upsertAccountSnapshot({
      accountId: "account-456",
      snapshotId: "snap_abc123",
    });

    expect(mockFrom).toHaveBeenCalledWith("account_snapshots");
    expect(result).toEqual({ data: null, error: mockError });
  });

  it("returns error when account_id foreign key constraint fails", async () => {
    const mockError = {
      message: 'insert or update on table "account_snapshots" violates foreign key constraint',
      code: "23503",
    };
    mockSingle.mockResolvedValue({ data: null, error: mockError });

    const result = await upsertAccountSnapshot({
      accountId: "non-existent-account",
      snapshotId: "snap_abc123",
    });

    expect(result).toEqual({ data: null, error: mockError });
  });
});
