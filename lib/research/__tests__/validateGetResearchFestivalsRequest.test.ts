import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { validateGetResearchFestivalsRequest } from "../validateGetResearchFestivalsRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));
vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

describe("validateGetResearchFestivalsRequest", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns auth error when auth fails", async () => {
    const errResp = NextResponse.json({ error: "no" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(errResp);
    const result = await validateGetResearchFestivalsRequest(
      new NextRequest("http://localhost/api/research/festivals"),
    );
    expect(result).toBe(errResp);
  });

  it("returns accountId on success", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acc-1",
      orgId: null,
      authToken: "t",
    });
    const result = await validateGetResearchFestivalsRequest(
      new NextRequest("http://localhost/api/research/festivals"),
    );
    expect(result).toEqual({ accountId: "acc-1" });
  });
});
