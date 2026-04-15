import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { validateGetResearchCuratorRequest } from "../validateGetResearchCuratorRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));
vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

describe("validateGetResearchCuratorRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acc-1",
      orgId: null,
      authToken: "t",
    });
  });

  it("returns auth error when auth fails", async () => {
    const errResp = NextResponse.json({ error: "no" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(errResp);
    const result = await validateGetResearchCuratorRequest(
      new NextRequest("http://localhost/api/research/curator?platform=spotify&id=123"),
    );
    expect(result).toBe(errResp);
  });

  it("returns 400 when platform is missing", async () => {
    const result = await validateGetResearchCuratorRequest(
      new NextRequest("http://localhost/api/research/curator?id=123"),
    );
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("returns 400 when id is missing", async () => {
    const result = await validateGetResearchCuratorRequest(
      new NextRequest("http://localhost/api/research/curator?platform=spotify"),
    );
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("returns accountId, platform, id on success", async () => {
    const result = await validateGetResearchCuratorRequest(
      new NextRequest("http://localhost/api/research/curator?platform=spotify&id=abc123"),
    );
    expect(result).toEqual({ accountId: "acc-1", platform: "spotify", id: "abc123" });
  });
});
