import { describe, it, expect, vi, beforeEach } from "vitest";

import { getAccountGithubRepo } from "../getAccountGithubRepo";

const mockSelectAccountSnapshots = vi.fn();

vi.mock("@/lib/supabase/account_snapshots/selectAccountSnapshots", () => ({
  selectAccountSnapshots: (...args: unknown[]) => mockSelectAccountSnapshots(...args),
}));

describe("getAccountGithubRepo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns github_repo when snapshot has one", async () => {
    mockSelectAccountSnapshots.mockResolvedValue([
      {
        snapshot_id: "snap_abc",
        account_id: "acc_1",
        github_repo: "https://github.com/artist/website",
        expires_at: null,
      },
    ]);

    const result = await getAccountGithubRepo("acc_1");

    expect(result).toBe("https://github.com/artist/website");
  });

  it("returns null when snapshot has no github_repo", async () => {
    mockSelectAccountSnapshots.mockResolvedValue([
      { snapshot_id: "snap_abc", account_id: "acc_1", github_repo: null, expires_at: null },
    ]);

    const result = await getAccountGithubRepo("acc_1");

    expect(result).toBeNull();
  });

  it("returns null when no snapshots exist", async () => {
    mockSelectAccountSnapshots.mockResolvedValue([]);

    const result = await getAccountGithubRepo("acc_1");

    expect(result).toBeNull();
  });
});
