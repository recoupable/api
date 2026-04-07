import { describe, it, expect, vi, beforeEach } from "vitest";

import { getValidSnapshotId } from "../getValidSnapshotId";

const mockSelectAccountSnapshots = vi.fn();

vi.mock("@/lib/supabase/account_snapshots/selectAccountSnapshots", () => ({
  selectAccountSnapshots: (...args: unknown[]) => mockSelectAccountSnapshots(...args),
}));

describe("getValidSnapshotId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns snapshot_id when snapshot exists and is not expired", async () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    mockSelectAccountSnapshots.mockResolvedValue([
      { snapshot_id: "snap_abc", account_id: "acc_1", expires_at: futureDate },
    ]);

    const result = await getValidSnapshotId("acc_1");

    expect(result).toBe("snap_abc");
  });

  it("returns snapshot_id when snapshot has no expires_at", async () => {
    mockSelectAccountSnapshots.mockResolvedValue([
      { snapshot_id: "snap_abc", account_id: "acc_1", expires_at: null },
    ]);

    const result = await getValidSnapshotId("acc_1");

    expect(result).toBe("snap_abc");
  });

  it("returns undefined when snapshot is expired", async () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    mockSelectAccountSnapshots.mockResolvedValue([
      { snapshot_id: "snap_expired", account_id: "acc_1", expires_at: pastDate },
    ]);

    const result = await getValidSnapshotId("acc_1");

    expect(result).toBeUndefined();
  });

  it("returns undefined when no snapshots exist", async () => {
    mockSelectAccountSnapshots.mockResolvedValue([]);

    const result = await getValidSnapshotId("acc_1");

    expect(result).toBeUndefined();
  });

  it("returns undefined when expires_at equals now", async () => {
    const now = new Date().toISOString();
    mockSelectAccountSnapshots.mockResolvedValue([
      { snapshot_id: "snap_edge", account_id: "acc_1", expires_at: now },
    ]);

    const result = await getValidSnapshotId("acc_1");

    expect(result).toBeUndefined();
  });

  it("returns undefined when expires_at is unparsable", async () => {
    mockSelectAccountSnapshots.mockResolvedValue([
      { snapshot_id: "snap_bad", account_id: "acc_1", expires_at: "not-a-date" },
    ]);

    const result = await getValidSnapshotId("acc_1");

    expect(result).toBeUndefined();
  });

  it("returns undefined when snapshot has no snapshot_id", async () => {
    mockSelectAccountSnapshots.mockResolvedValue([
      { snapshot_id: null, account_id: "acc_1", expires_at: null },
    ]);

    const result = await getValidSnapshotId("acc_1");

    expect(result).toBeUndefined();
  });
});
