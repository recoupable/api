import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateGetArtistsProRequest } from "../validateGetArtistsProRequest";
import { validateAdminAuth } from "@/lib/admins/validateAdminAuth";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/admins/validateAdminAuth", () => ({
  validateAdminAuth: vi.fn(),
}));

describe("validateGetArtistsProRequest", () => {
  const request = new NextRequest("http://localhost/api/admins/artists/pro");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an empty payload when admin auth passes", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      accountId: "acc-1",
      orgId: null,
      authToken: "t",
    });

    const result = await validateGetArtistsProRequest(request);

    expect(result).toEqual({});
    expect(validateAdminAuth).toHaveBeenCalledWith(request);
  });

  it("propagates the 401 NextResponse when auth is missing", async () => {
    const err = NextResponse.json({ status: "error", error: "no auth" }, { status: 401 });
    vi.mocked(validateAdminAuth).mockResolvedValue(err);

    const result = await validateGetArtistsProRequest(request);

    expect(result).toBe(err);
  });

  it("propagates the 403 NextResponse when caller is not admin", async () => {
    const err = NextResponse.json({ status: "error", message: "Forbidden" }, { status: 403 });
    vi.mocked(validateAdminAuth).mockResolvedValue(err);

    const result = await validateGetArtistsProRequest(request);

    expect(result).toBe(err);
  });
});
