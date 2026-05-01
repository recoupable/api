import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { validatePostResearchEnrichRequest } from "../validatePostResearchEnrichRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));

function req(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/research/enrich", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("validatePostResearchEnrichRequest", () => {
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
    const res = await validatePostResearchEnrichRequest(req({ input: "x", schema: {} }));
    expect(res).toBe(err);
  });

  it("returns 400 when input missing", async () => {
    const res = await validatePostResearchEnrichRequest(req({ schema: {} }));
    expect((res as NextResponse).status).toBe(400);
  });

  it("returns 400 when schema missing", async () => {
    const res = await validatePostResearchEnrichRequest(req({ input: "x" }));
    expect((res as NextResponse).status).toBe(400);
  });

  it("returns 400 for invalid processor", async () => {
    const res = await validatePostResearchEnrichRequest(
      req({ input: "x", schema: {}, processor: "mega" }),
    );
    expect((res as NextResponse).status).toBe(400);
  });

  it("returns validated payload with default processor", async () => {
    const res = await validatePostResearchEnrichRequest(req({ input: "x", schema: { k: 1 } }));
    expect(res).toEqual({
      accountId: "acct",
      input: "x",
      schema: { k: 1 },
      processor: "base",
    });
  });
});
