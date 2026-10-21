import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/sandboxes/route";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { canAccessAccount } from "@/lib/organizations/canAccessAccount";
import { selectAccountSandboxes } from "@/lib/supabase/account_sandboxes/selectAccountSandboxes";
import { selectAccountSnapshots } from "@/lib/supabase/account_snapshots/selectAccountSnapshots";
import { getSandboxStatus } from "@/lib/sandbox/getSandboxStatus";
import { getRepoFileTree } from "@/lib/github/getRepoFileTree";

vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/organizations/canAccessAccount", () => ({ canAccessAccount: vi.fn() }));
vi.mock("@/lib/supabase/account_sandboxes/selectAccountSandboxes", () => ({
  selectAccountSandboxes: vi.fn(),
}));
vi.mock("@/lib/supabase/account_snapshots/selectAccountSnapshots", () => ({
  selectAccountSnapshots: vi.fn(),
}));
vi.mock("@/lib/sandbox/getSandboxStatus", () => ({ getSandboxStatus: vi.fn() }));
vi.mock("@/lib/github/getRepoFileTree", () => ({ getRepoFileTree: vi.fn() }));
vi.mock("@/lib/sandbox/createSandboxPostHandler", () => ({ createSandboxPostHandler: vi.fn() }));
vi.mock("@/lib/sandbox/deleteSandboxHandler", () => ({ deleteSandboxHandler: vi.fn() }));
vi.mock("@/lib/sandbox/updateSnapshotPatchHandler", () => ({
  updateSnapshotPatchHandler: vi.fn(),
}));

const accountId = "123e4567-e89b-42d3-a456-426614174000";
const targetId = "123e4567-e89b-42d3-a456-426614174001";
const snapshot = {
  account_id: accountId,
  snapshot_id: "snapshot",
  github_repo: "https://github.com/example/workspace",
  created_at: "2026-10-21",
  expires_at: null,
};
const filetree = [{ path: "README.md", type: "blob" as const, sha: "abc" }];
const status = {
  sandboxId: "sandbox",
  sandboxStatus: "running" as const,
  timeout: 1000,
  createdAt: "2026-10-21",
};
function request(query = "metadata_only=true") {
  return new NextRequest(`https://example.com/api/sandboxes?${query}`);
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(validateAuthContext).mockResolvedValue({
    accountId,
    orgId: null,
    authToken: "fixture",
  });
  vi.mocked(canAccessAccount).mockResolvedValue(true);
  vi.mocked(selectAccountSandboxes).mockResolvedValue(
    Array.from({ length: 100 }, (_, i) => ({
      id: String(i),
      account_id: accountId,
      sandbox_id: `sandbox-${i}`,
      created_at: "2026-10-21",
    })),
  );
  vi.mocked(selectAccountSnapshots).mockResolvedValue([snapshot]);
  vi.mocked(getRepoFileTree).mockResolvedValue(filetree);
  vi.mocked(getSandboxStatus).mockResolvedValue(status);
});
describe("GET sandbox metadata", () => {
  it("returns the existing metadata envelope without querying live statuses", async () => {
    vi.mocked(getSandboxStatus).mockRejectedValue(new Error("must not call provider"));
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "success",
      sandboxes: [],
      snapshot_id: "snapshot",
      github_repo: snapshot.github_repo,
      filetree,
    });
    expect(getSandboxStatus).not.toHaveBeenCalled();
    expect(selectAccountSnapshots).toHaveBeenCalledWith(accountId);
    expect(getRepoFileTree).toHaveBeenCalledWith(snapshot.github_repo);
  });
  it.each(["", "metadata_only=false"])("keeps live status behavior for %s", async query => {
    const response = await GET(request(query));
    expect(response.status).toBe(200);
    expect((await response.json()).sandboxes).toHaveLength(100);
    expect(getSandboxStatus).toHaveBeenCalledTimes(100);
  });
  it.each(["1", "yes", "TRUE", "", " true "])(
    "rejects invalid metadata_only=%s before dependencies",
    async value => {
      const response = await GET(request(`metadata_only=${encodeURIComponent(value)}`));
      expect(response.status).toBe(400);
      expect(validateAuthContext).not.toHaveBeenCalled();
      expect(selectAccountSnapshots).not.toHaveBeenCalled();
      expect(selectAccountSandboxes).not.toHaveBeenCalled();
      expect(getSandboxStatus).not.toHaveBeenCalled();
    },
  );
  it("still authenticates", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
    expect((await GET(request())).status).toBe(401);
    expect(selectAccountSnapshots).not.toHaveBeenCalled();
    expect(selectAccountSandboxes).not.toHaveBeenCalled();
  });
  it("keeps authorized target account and sandbox filters", async () => {
    expect(
      (await GET(request(`metadata_only=true&account_id=${targetId}&sandbox_id=selected`))).status,
    ).toBe(200);
    expect(canAccessAccount).toHaveBeenCalledWith({
      targetAccountId: targetId,
      currentAccountId: accountId,
    });
    expect(selectAccountSnapshots).toHaveBeenCalledWith(targetId);
    expect(selectAccountSandboxes).toHaveBeenCalledWith(
      expect.objectContaining({ accountIds: [targetId], sandboxId: "selected" }),
    );
    expect(getSandboxStatus).not.toHaveBeenCalled();
  });
  it("does not bypass denied target access", async () => {
    vi.mocked(canAccessAccount).mockResolvedValue(false);
    expect((await GET(request(`metadata_only=true&account_id=${targetId}`))).status).toBe(403);
    expect(selectAccountSnapshots).not.toHaveBeenCalled();
    expect(selectAccountSandboxes).not.toHaveBeenCalled();
    expect(getRepoFileTree).not.toHaveBeenCalled();
  });
  it("returns existing null metadata when no snapshot exists", async () => {
    vi.mocked(selectAccountSnapshots).mockResolvedValue([]);
    const response = await GET(request());
    expect(await response.json()).toEqual({
      status: "success",
      sandboxes: [],
      snapshot_id: null,
      github_repo: null,
      filetree: null,
    });
    expect(getSandboxStatus).not.toHaveBeenCalled();
    expect(getRepoFileTree).not.toHaveBeenCalled();
  });
});
