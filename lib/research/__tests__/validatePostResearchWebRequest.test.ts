import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { validatePostResearchWebRequest } from "../validatePostResearchWebRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));

function req(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/research/web", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("validatePostResearchWebRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acct",
      orgId: null,
      authToken: "t",
    } as never);
  });

  it("returns auth error response", async () => {
    const err = NextResponse.json({ error: "nope" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(err);
    const res = await validatePostResearchWebRequest(req({ query: "x" }));
    expect(res).toBe(err);
  });

  it("returns 400 when query is missing", async () => {
    const res = await validatePostResearchWebRequest(req({}));
    expect(res).toBeInstanceOf(NextResponse);
    expect((res as NextResponse).status).toBe(400);
  });

  it("returns 400 when max_results is out of range", async () => {
    const res = await validatePostResearchWebRequest(req({ query: "x", max_results: 99 }));
    expect((res as NextResponse).status).toBe(400);
  });

  it("returns validated payload on success", async () => {
    const res = await validatePostResearchWebRequest(req({ query: "x", country: "US" }));
    expect(res).toEqual({ accountId: "acct", query: "x", country: "US" });
  });
});
