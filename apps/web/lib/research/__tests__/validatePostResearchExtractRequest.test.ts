import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { validatePostResearchExtractRequest } from "../validatePostResearchExtractRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));

function req(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/research/extract", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("validatePostResearchExtractRequest", () => {
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
    const res = await validatePostResearchExtractRequest(req({ urls: ["https://a.com"] }));
    expect(res).toBe(err);
  });

  it("returns 400 when urls is missing", async () => {
    const res = await validatePostResearchExtractRequest(req({}));
    expect((res as NextResponse).status).toBe(400);
  });

  it("returns 400 when urls is empty", async () => {
    const res = await validatePostResearchExtractRequest(req({ urls: [] }));
    expect((res as NextResponse).status).toBe(400);
  });

  it("returns 400 when too many urls", async () => {
    const urls = Array.from({ length: 11 }, (_, i) => `https://a.com/${i}`);
    const res = await validatePostResearchExtractRequest(req({ urls }));
    expect((res as NextResponse).status).toBe(400);
  });

  it("returns validated payload on success", async () => {
    const res = await validatePostResearchExtractRequest(
      req({ urls: ["https://a.com"], objective: "obj", full_content: true }),
    );
    expect(res).toEqual({
      accountId: "acct",
      urls: ["https://a.com"],
      objective: "obj",
      full_content: true,
    });
  });
});
