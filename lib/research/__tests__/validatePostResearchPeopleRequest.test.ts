import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { validatePostResearchPeopleRequest } from "../validatePostResearchPeopleRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));

function req(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/research/people", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("validatePostResearchPeopleRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acct",
      orgId: null,
      authToken: "t",
    } as never);
  });

  it("returns auth error", async () => {
    const err = NextResponse.json({ error: "nope" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(err);
    const res = await validatePostResearchPeopleRequest(req({ query: "x" }));
    expect(res).toBe(err);
  });

  it("returns 400 when query missing", async () => {
    const res = await validatePostResearchPeopleRequest(req({}));
    expect((res as NextResponse).status).toBe(400);
  });

  it("returns 400 when num_results > 100", async () => {
    const res = await validatePostResearchPeopleRequest(req({ query: "x", num_results: 101 }));
    expect((res as NextResponse).status).toBe(400);
  });

  it("returns validated payload on success", async () => {
    const res = await validatePostResearchPeopleRequest(req({ query: "x", num_results: 5 }));
    expect(res).toEqual({ accountId: "acct", query: "x", num_results: 5 });
  });
});
