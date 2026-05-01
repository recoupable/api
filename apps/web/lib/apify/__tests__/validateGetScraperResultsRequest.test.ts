import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { validateGetScraperResultsRequest } from "../validateGetScraperResultsRequest";
import { validateAdminAuth } from "@/lib/admins/validateAdminAuth";

vi.mock("@/lib/admins/validateAdminAuth", () => ({ validateAdminAuth: vi.fn() }));
vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: () => ({}) }));

const RUN_ID = "run_abc_123";
const ACCOUNT_ID = "660e8400-e29b-41d4-a716-446655440000";
const authResult = { accountId: ACCOUNT_ID, authToken: "t", orgId: null };

const makeRequest = (path = `/api/apify/runs/${RUN_ID}`) =>
  new NextRequest(`http://localhost${path}`, { headers: { "x-api-key": "k" } });

describe("validateGetScraperResultsRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAdminAuth).mockResolvedValue(authResult);
  });

  it("propagates auth error before checking runId", async () => {
    const err = NextResponse.json({}, { status: 401 });
    vi.mocked(validateAdminAuth).mockResolvedValue(err);
    expect(await validateGetScraperResultsRequest(makeRequest(), "")).toBe(err);
  });

  it("propagates 403 from non-admin auth", async () => {
    const err = NextResponse.json({}, { status: 403 });
    vi.mocked(validateAdminAuth).mockResolvedValue(err);
    expect(await validateGetScraperResultsRequest(makeRequest(), RUN_ID)).toBe(err);
  });

  it("returns 400 when runId is empty after admin auth succeeds", async () => {
    const res = (await validateGetScraperResultsRequest(makeRequest(), "")) as NextResponse;
    expect(res.status).toBe(400);
  });

  it("returns validated runId on happy path", async () => {
    expect(await validateGetScraperResultsRequest(makeRequest(), RUN_ID)).toEqual({
      runId: RUN_ID,
    });
  });
});
