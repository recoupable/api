import { describe, it, expect, vi, beforeEach } from "vitest";
import { isSandboxProvisioned } from "@/lib/sandbox/isSandboxProvisioned";
import { selectAccountSnapshots } from "@/lib/supabase/account_snapshots/selectAccountSnapshots";

vi.mock("@/lib/supabase/account_snapshots/selectAccountSnapshots", () => ({
  selectAccountSnapshots: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("isSandboxProvisioned", () => {
  it("returns false when no snapshots exist", async () => {
    vi.mocked(selectAccountSnapshots).mockResolvedValue([]);
    expect(await isSandboxProvisioned("acc_123")).toBe(false);
  });

  it("returns false when snapshot_id is missing", async () => {
    vi.mocked(selectAccountSnapshots).mockResolvedValue([
      {
        account_id: "acc_123",
        snapshot_id: null,
        github_repo: "https://github.com/org/repo",
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        created_at: new Date().toISOString(),
      } as any,
    ]);
    expect(await isSandboxProvisioned("acc_123")).toBe(false);
  });

  it("returns false when github_repo is missing", async () => {
    vi.mocked(selectAccountSnapshots).mockResolvedValue([
      {
        account_id: "acc_123",
        snapshot_id: "snap_123",
        github_repo: null,
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        created_at: new Date().toISOString(),
      } as any,
    ]);
    expect(await isSandboxProvisioned("acc_123")).toBe(false);
  });

  it("returns false when snapshot is expired", async () => {
    vi.mocked(selectAccountSnapshots).mockResolvedValue([
      {
        account_id: "acc_123",
        snapshot_id: "snap_123",
        github_repo: "https://github.com/org/repo",
        expires_at: new Date(Date.now() - 86400000).toISOString(),
        created_at: new Date().toISOString(),
      } as any,
    ]);
    expect(await isSandboxProvisioned("acc_123")).toBe(false);
  });

  it("returns true when snapshot and github_repo exist and not expired", async () => {
    vi.mocked(selectAccountSnapshots).mockResolvedValue([
      {
        account_id: "acc_123",
        snapshot_id: "snap_123",
        github_repo: "https://github.com/org/repo",
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        created_at: new Date().toISOString(),
      } as any,
    ]);
    expect(await isSandboxProvisioned("acc_123")).toBe(true);
  });
});
