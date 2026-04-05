import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { updateSnapshotPatchHandler } from "../updateSnapshotPatchHandler";
import { validateSnapshotPatchBody } from "@/lib/sandbox/validateSnapshotPatchBody";
import { upsertAccountSnapshot } from "@/lib/supabase/account_snapshots/upsertAccountSnapshot";
import { selectAccountSnapshots } from "@/lib/supabase/account_snapshots/selectAccountSnapshots";

vi.mock("@/lib/sandbox/validateSnapshotPatchBody", () => ({
  validateSnapshotPatchBody: vi.fn(),
}));

vi.mock("@/lib/supabase/account_snapshots/upsertAccountSnapshot", () => ({
  upsertAccountSnapshot: vi.fn(),
}));

vi.mock("@/lib/supabase/account_snapshots/selectAccountSnapshots", () => ({
  selectAccountSnapshots: vi.fn(),
}));

/**
 * Creates a mock NextRequest for testing.
 *
 * @returns A mock NextRequest object
 */
function createMockRequest(): NextRequest {
  return {
    headers: new Headers({ "x-api-key": "test-key" }),
  } as unknown as NextRequest;
}

describe("updateSnapshotPatchHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error response when validation fails", async () => {
    vi.mocked(validateSnapshotPatchBody).mockResolvedValue(
      NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
    );

    const request = createMockRequest();
    const response = await updateSnapshotPatchHandler(request);

    expect(response.status).toBe(401);
  });

  it("upserts with github_repo when github_repo is provided", async () => {
    vi.mocked(validateSnapshotPatchBody).mockResolvedValue({
      accountId: "acc_123",
      githubRepo: "https://github.com/org/repo",
    });
    vi.mocked(upsertAccountSnapshot).mockResolvedValue({
      data: {
        account_id: "acc_123",
        snapshot_id: null,
        expires_at: "2025-01-01T00:00:00.000Z",
        created_at: "2024-01-01T00:00:00.000Z",
        github_repo: "https://github.com/org/repo",
      },
      error: null,
    });

    const request = createMockRequest();
    const response = await updateSnapshotPatchHandler(request);

    expect(upsertAccountSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        account_id: "acc_123",
        github_repo: "https://github.com/org/repo",
      }),
    );
    expect(response.status).toBe(200);
  });

  it("returns current row when no fields to update", async () => {
    vi.mocked(validateSnapshotPatchBody).mockResolvedValue({
      accountId: "acc_123",
    });
    vi.mocked(selectAccountSnapshots).mockResolvedValue([
      {
        account_id: "acc_123",
        snapshot_id: "snap_existing",
        expires_at: "2025-01-01T00:00:00.000Z",
        created_at: "2024-01-01T00:00:00.000Z",
        github_repo: "https://github.com/org/repo",
      },
    ]);

    const request = createMockRequest();
    const response = await updateSnapshotPatchHandler(request);

    expect(upsertAccountSnapshot).not.toHaveBeenCalled();
    expect(selectAccountSnapshots).toHaveBeenCalledWith("acc_123");
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual({
      account_id: "acc_123",
      snapshot_id: "snap_existing",
      expires_at: "2025-01-01T00:00:00.000Z",
      created_at: "2024-01-01T00:00:00.000Z",
      github_repo: "https://github.com/org/repo",
    });
  });

  it("returns 400 when upsertAccountSnapshot returns error", async () => {
    vi.mocked(validateSnapshotPatchBody).mockResolvedValue({
      accountId: "acc_123",
      githubRepo: "https://github.com/org/repo",
    });
    vi.mocked(upsertAccountSnapshot).mockResolvedValue({
      data: null,
      error: { message: "Database error", details: "", hint: "", code: "23503" },
    });

    const request = createMockRequest();
    const response = await updateSnapshotPatchHandler(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json).toEqual({
      status: "error",
      error: "Failed to update sandbox metadata",
    });
  });

  it("returns 400 when upsertAccountSnapshot throws error", async () => {
    vi.mocked(validateSnapshotPatchBody).mockResolvedValue({
      accountId: "acc_123",
      githubRepo: "https://github.com/org/repo",
    });
    vi.mocked(upsertAccountSnapshot).mockRejectedValue(new Error("Unexpected error"));

    const request = createMockRequest();
    const response = await updateSnapshotPatchHandler(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json).toEqual({
      status: "error",
      error: "Unexpected error",
    });
  });
});
