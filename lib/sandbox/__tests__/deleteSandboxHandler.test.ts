import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

import { deleteSandboxHandler } from "../deleteSandboxHandler";
import { validateDeleteSandboxBody } from "../validateDeleteSandboxBody";
import { selectAccountSnapshots } from "@/lib/supabase/account_snapshots/selectAccountSnapshots";
import { deleteAccountSnapshot } from "@/lib/supabase/account_snapshots/deleteAccountSnapshot";
import { deleteGithubRepo } from "@/lib/github/deleteGithubRepo";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/sandbox/validateDeleteSandboxBody", () => ({
  validateDeleteSandboxBody: vi.fn(),
}));

vi.mock("@/lib/supabase/account_snapshots/selectAccountSnapshots", () => ({
  selectAccountSnapshots: vi.fn(),
}));

vi.mock("@/lib/supabase/account_snapshots/deleteAccountSnapshot", () => ({
  deleteAccountSnapshot: vi.fn(),
}));

vi.mock("@/lib/github/deleteGithubRepo", () => ({
  deleteGithubRepo: vi.fn(),
}));

/**
 *
 */
function createMockRequest(): Request {
  return new Request("https://example.com/api/sandboxes", {
    method: "DELETE",
  });
}

describe("deleteSandboxHandler", () => {
  const mockAccountId = "550e8400-e29b-41d4-a716-446655440000";
  const mockSnapshot = {
    account_id: mockAccountId,
    snapshot_id: "snap_abc123",
    github_repo: "https://github.com/recoupable/test-repo",
    expires_at: "2027-01-01T00:00:00.000Z",
    created_at: "2025-01-01T00:00:00.000Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns validation error when validation fails", async () => {
    vi.mocked(validateDeleteSandboxBody).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const request = createMockRequest();
    const response = await deleteSandboxHandler(request as never);

    expect(response.status).toBe(401);
    expect(selectAccountSnapshots).not.toHaveBeenCalled();
  });

  it("returns success with null deleted_snapshot when no snapshot exists", async () => {
    vi.mocked(validateDeleteSandboxBody).mockResolvedValue({
      accountId: mockAccountId,
    });
    vi.mocked(selectAccountSnapshots).mockResolvedValue([]);

    const request = createMockRequest();
    const response = await deleteSandboxHandler(request as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("success");
    expect(body.deleted_snapshot).toBeNull();
    expect(deleteGithubRepo).not.toHaveBeenCalled();
    expect(deleteAccountSnapshot).not.toHaveBeenCalled();
  });

  it("deletes github repo and snapshot when snapshot has github_repo", async () => {
    vi.mocked(validateDeleteSandboxBody).mockResolvedValue({
      accountId: mockAccountId,
    });
    vi.mocked(selectAccountSnapshots).mockResolvedValue([mockSnapshot]);
    vi.mocked(deleteGithubRepo).mockResolvedValue(true);
    vi.mocked(deleteAccountSnapshot).mockResolvedValue(mockSnapshot);

    const request = createMockRequest();
    const response = await deleteSandboxHandler(request as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("success");
    expect(body.deleted_snapshot).toEqual(mockSnapshot);
    expect(deleteGithubRepo).toHaveBeenCalledWith(mockSnapshot.github_repo);
    expect(deleteAccountSnapshot).toHaveBeenCalledWith(mockAccountId);
  });

  it("skips github repo deletion when snapshot has no github_repo", async () => {
    const snapshotWithoutRepo = { ...mockSnapshot, github_repo: null };
    vi.mocked(validateDeleteSandboxBody).mockResolvedValue({
      accountId: mockAccountId,
    });
    vi.mocked(selectAccountSnapshots).mockResolvedValue([snapshotWithoutRepo]);
    vi.mocked(deleteAccountSnapshot).mockResolvedValue(snapshotWithoutRepo);

    const request = createMockRequest();
    const response = await deleteSandboxHandler(request as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("success");
    expect(deleteGithubRepo).not.toHaveBeenCalled();
    expect(deleteAccountSnapshot).toHaveBeenCalledWith(mockAccountId);
  });

  it("still deletes snapshot when github repo deletion fails (best-effort)", async () => {
    vi.mocked(validateDeleteSandboxBody).mockResolvedValue({
      accountId: mockAccountId,
    });
    vi.mocked(selectAccountSnapshots).mockResolvedValue([mockSnapshot]);
    vi.mocked(deleteGithubRepo).mockResolvedValue(false);
    vi.mocked(deleteAccountSnapshot).mockResolvedValue(mockSnapshot);

    const request = createMockRequest();
    const response = await deleteSandboxHandler(request as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("success");
    expect(body.deleted_snapshot).toEqual(mockSnapshot);
    expect(deleteAccountSnapshot).toHaveBeenCalledWith(mockAccountId);
  });

  it("returns 500 when deleteAccountSnapshot throws", async () => {
    vi.mocked(validateDeleteSandboxBody).mockResolvedValue({
      accountId: mockAccountId,
    });
    vi.mocked(selectAccountSnapshots).mockResolvedValue([mockSnapshot]);
    vi.mocked(deleteGithubRepo).mockResolvedValue(true);
    vi.mocked(deleteAccountSnapshot).mockRejectedValue(new Error("Database error"));

    const request = createMockRequest();
    const response = await deleteSandboxHandler(request as never);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.status).toBe("error");
    expect(body.error).toBe("Database error");
  });
});
