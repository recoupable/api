import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { validateGetScraperResultsRequest } from "../validateGetScraperResultsRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { checkIsAdmin } from "@/lib/admins/checkIsAdmin";
import { selectApifyScraperRuns } from "@/lib/supabase/apify_scraper_runs/selectApifyScraperRuns";

vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/admins/checkIsAdmin", () => ({ checkIsAdmin: vi.fn() }));
vi.mock("@/lib/supabase/apify_scraper_runs/selectApifyScraperRuns", () => ({
  selectApifyScraperRuns: vi.fn(),
}));
vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: () => ({}) }));

const RUN_ID = "run_abc_123";
const ACCOUNT_ID = "660e8400-e29b-41d4-a716-446655440000";
const OTHER_ACCOUNT_ID = "770e8400-e29b-41d4-a716-446655440000";
const authResult = { accountId: ACCOUNT_ID, authToken: "t", orgId: null };

const makeRequest = (path = `/api/apify/runs/${RUN_ID}`) =>
  new NextRequest(`http://localhost${path}`, { headers: { "x-api-key": "k" } });

const ownedRun = { run_id: RUN_ID, account_id: ACCOUNT_ID, social_id: null, created_at: "" };

describe("validateGetScraperResultsRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue(authResult);
    vi.mocked(checkIsAdmin).mockResolvedValue(false);
    vi.mocked(selectApifyScraperRuns).mockResolvedValue([ownedRun as never]);
  });

  it("propagates auth error before checking runId", async () => {
    const err = NextResponse.json({}, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(err);
    expect(await validateGetScraperResultsRequest(makeRequest(), "")).toBe(err);
  });

  it("returns 400 when runId is empty after auth succeeds", async () => {
    const res = (await validateGetScraperResultsRequest(makeRequest(), "")) as NextResponse;
    expect(res.status).toBe(400);
  });

  it("passes an admin through without an ownership lookup", async () => {
    vi.mocked(checkIsAdmin).mockResolvedValue(true);
    expect(await validateGetScraperResultsRequest(makeRequest(), RUN_ID)).toEqual({
      runId: RUN_ID,
    });
    expect(selectApifyScraperRuns).not.toHaveBeenCalled();
  });

  it("passes the owning account through (non-admin)", async () => {
    expect(await validateGetScraperResultsRequest(makeRequest(), RUN_ID)).toEqual({
      runId: RUN_ID,
    });
    expect(selectApifyScraperRuns).toHaveBeenCalledWith({ runId: RUN_ID });
  });

  it("returns 403 Forbidden when the run belongs to a different account", async () => {
    vi.mocked(selectApifyScraperRuns).mockResolvedValue([
      { ...ownedRun, account_id: OTHER_ACCOUNT_ID } as never,
    ]);
    const res = (await validateGetScraperResultsRequest(makeRequest(), RUN_ID)) as NextResponse;
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ status: "error", message: "Forbidden" });
  });

  it("returns 404 when the run has no recorded owner (non-admin)", async () => {
    vi.mocked(selectApifyScraperRuns).mockResolvedValue([]);
    const res = (await validateGetScraperResultsRequest(makeRequest(), RUN_ID)) as NextResponse;
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ status: "error", message: "Run not found" });
  });

  it("returns 404 when the ownership lookup fails (null result, non-admin)", async () => {
    vi.mocked(selectApifyScraperRuns).mockResolvedValue(null);
    const res = (await validateGetScraperResultsRequest(makeRequest(), RUN_ID)) as NextResponse;
    expect(res.status).toBe(404);
  });
});
