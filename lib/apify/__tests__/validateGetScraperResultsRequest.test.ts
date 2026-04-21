import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { validateGetScraperResultsRequest } from "../validateGetScraperResultsRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: () => ({}) }));

const RUN_ID = "run_abc_123";
const ACCOUNT_ID = "660e8400-e29b-41d4-a716-446655440000";
const authResult = { accountId: ACCOUNT_ID, authToken: "t", orgId: null };

const makeRequest = (path = `/api/apify/runs/${RUN_ID}`) =>
  new NextRequest(`http://localhost${path}`, { headers: { "x-api-key": "k" } });

describe("validateGetScraperResultsRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue(authResult);
  });

  it("returns 400 when runId is empty", async () => {
    const res = (await validateGetScraperResultsRequest(makeRequest(), "")) as NextResponse;
    expect(res.status).toBe(400);
  });

  it("does not call validateAuthContext when runId is missing", async () => {
    await validateGetScraperResultsRequest(makeRequest(), "");
    expect(validateAuthContext).not.toHaveBeenCalled();
  });

  it("propagates auth error", async () => {
    const err = NextResponse.json({}, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(err);
    expect(await validateGetScraperResultsRequest(makeRequest(), RUN_ID)).toBe(err);
  });

  it("returns validated runId on happy path", async () => {
    expect(await validateGetScraperResultsRequest(makeRequest(), RUN_ID)).toEqual({
      runId: RUN_ID,
    });
  });

  it("does not include authContext in return shape", async () => {
    const result = (await validateGetScraperResultsRequest(makeRequest(), RUN_ID)) as Record<
      string,
      unknown
    >;
    expect(result).not.toHaveProperty("authContext");
  });
});
