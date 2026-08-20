import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getRunsHandler } from "../getRunsHandler";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { selectLatestAccountSnapshots } from "@/lib/supabase/playcount_snapshots/selectLatestAccountSnapshots";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/supabase/playcount_snapshots/selectLatestAccountSnapshots", () => ({
  selectLatestAccountSnapshots: vi.fn(),
}));

const accountId = "550e8400-e29b-41d4-a716-446655440000";
const makeRequest = (qs: string) =>
  new NextRequest(`http://localhost/api/runs${qs}`, { method: "GET" });

const snapshot = (over: Record<string, unknown>) =>
  ({
    id: "11111111-2222-3333-4444-555555555555",
    account: accountId,
    album_count: 9,
    created_at: new Date().toISOString(),
    catalog: null,
    state: "queued",
    ...over,
  }) as never;

describe("getRunsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId,
      orgId: null,
      authToken: "t",
    } as never);
  });

  it("returns the caller's latest run mapped to the run resource", async () => {
    vi.mocked(selectLatestAccountSnapshots).mockResolvedValue([
      snapshot({ state: "done", catalog: "cat_1" }),
    ]);

    const res = await getRunsHandler(makeRequest("?kind=valuation"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(selectLatestAccountSnapshots).toHaveBeenCalledWith({ account: accountId, limit: 1 });
    expect(body.status).toBe("success");
    expect(body.runs).toHaveLength(1);
    expect(body.runs[0]).toMatchObject({
      kind: "valuation",
      state: "claimed",
      result: { catalog_id: "cat_1" },
    });
  });

  it("returns empty runs for an account that never ran one", async () => {
    vi.mocked(selectLatestAccountSnapshots).mockResolvedValue([]);

    const res = await getRunsHandler(makeRequest("?kind=valuation"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.runs).toEqual([]);
  });

  it("passes the requested limit through", async () => {
    vi.mocked(selectLatestAccountSnapshots).mockResolvedValue([]);

    await getRunsHandler(makeRequest("?kind=valuation&limit=5"));

    expect(selectLatestAccountSnapshots).toHaveBeenCalledWith({ account: accountId, limit: 5 });
  });

  it("rejects an unknown kind with 400 before touching the database", async () => {
    const res = await getRunsHandler(makeRequest("?kind=backfill"));

    expect(res.status).toBe(400);
    expect(selectLatestAccountSnapshots).not.toHaveBeenCalled();
  });

  it("returns 500 when the snapshot read fails, never an empty run list", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(selectLatestAccountSnapshots).mockRejectedValue(new Error("db down"));

    const res = await getRunsHandler(makeRequest("?kind=valuation"));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.status).toBe("error");
    consoleSpy.mockRestore();
  });

  it("returns the auth error untouched when unauthenticated", async () => {
    const authErr = NextResponse.json({ status: "error" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(authErr as never);

    const res = await getRunsHandler(makeRequest("?kind=valuation"));

    expect(res.status).toBe(401);
    expect(selectLatestAccountSnapshots).not.toHaveBeenCalled();
  });
});
