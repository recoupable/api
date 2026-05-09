import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET, OPTIONS } from "../route";
import type { Tables } from "@/types/database.types";

type SessionRow = Tables<"sessions">;

vi.mock("@/lib/supabase/sessions/selectSessions", () => ({
  selectSessions: vi.fn(),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

const { selectSessions } = await import("@/lib/supabase/sessions/selectSessions");
const { validateAuthContext } = await import("@/lib/auth/validateAuthContext");

function makeReq(url = "https://example.com/api/sessions/sess_1"): NextRequest {
  return new NextRequest(url);
}

const mockRow: SessionRow = {
  id: "sess_1",
  account_id: "acc-uuid-1",
  title: "Test session",
  status: "running",
  repo_owner: "acme",
  repo_name: "demo",
  branch: "main",
  clone_url: "https://github.com/acme/demo.git",
  is_new_branch: false,
  global_skill_refs: [],
  sandbox_state: { type: "vercel" },
  lifecycle_state: "active",
  lifecycle_version: 1,
  last_activity_at: "2026-05-04T00:00:00.000Z",
  sandbox_expires_at: null,
  hibernate_after: null,
  lifecycle_run_id: null,
  lifecycle_error: null,
  lines_added: 12,
  lines_removed: 3,
  snapshot_url: null,
  snapshot_created_at: null,
  snapshot_size_bytes: null,
  cached_diff: null,
  cached_diff_updated_at: null,
  created_at: "2026-05-01T00:00:00.000Z",
  updated_at: "2026-05-04T00:00:00.000Z",
};

describe("OPTIONS /api/sessions/[sessionId]", () => {
  it("returns 200 with CORS headers", async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(200);
  });
});

describe("GET /api/sessions/[sessionId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when auth fails", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const res = await GET(makeReq(), {
      params: Promise.resolve({ sessionId: "sess_1" }),
    });
    expect(res.status).toBe(401);
    expect(selectSessions).not.toHaveBeenCalled();
  });

  it("returns 404 when session does not exist", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acc-uuid-1",
      orgId: null,
      authToken: "tok",
    });
    vi.mocked(selectSessions).mockResolvedValue([]);

    const res = await GET(makeReq(), {
      params: Promise.resolve({ sessionId: "sess_missing" }),
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      status: "error",
      error: "Session not found",
    });
    expect(selectSessions).toHaveBeenCalledWith({ id: "sess_missing" });
  });

  it("returns 403 when session is owned by a different account", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acc-uuid-OTHER",
      orgId: null,
      authToken: "tok",
    });
    vi.mocked(selectSessions).mockResolvedValue([mockRow]);

    const res = await GET(makeReq(), {
      params: Promise.resolve({ sessionId: "sess_1" }),
    });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      status: "error",
      error: "Forbidden",
    });
  });

  it("returns 200 with camelCase session shape on happy path", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acc-uuid-1",
      orgId: null,
      authToken: "tok",
    });
    vi.mocked(selectSessions).mockResolvedValue([mockRow]);

    const res = await GET(makeReq(), {
      params: Promise.resolve({ sessionId: "sess_1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      session: {
        id: "sess_1",
        userId: "acc-uuid-1",
        title: "Test session",
        status: "running",
        repoOwner: "acme",
        repoName: "demo",
        branch: "main",
        cloneUrl: "https://github.com/acme/demo.git",
        isNewBranch: false,
        globalSkillRefs: [],
        sandboxState: { type: "vercel" },
        lifecycleState: "active",
        lifecycleVersion: 1,
        lastActivityAt: "2026-05-04T00:00:00.000Z",
        sandboxExpiresAt: null,
        hibernateAfter: null,
        lifecycleRunId: null,
        lifecycleError: null,
        linesAdded: 12,
        linesRemoved: 3,
        snapshotUrl: null,
        snapshotCreatedAt: null,
        snapshotSizeBytes: null,
        cachedDiff: null,
        cachedDiffUpdatedAt: null,
        createdAt: "2026-05-01T00:00:00.000Z",
        updatedAt: "2026-05-04T00:00:00.000Z",
      },
    });
  });
});
