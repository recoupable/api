import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { validateGetArtistFansRequest } from "../validateGetArtistFansRequest";

const mockValidateAuthContext = vi.fn();

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: (...args: unknown[]) => mockValidateAuthContext(...args),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

const VALID_UUID = "11111111-1111-4111-8111-111111111111";

function makeRequest(url: string): NextRequest {
  return new NextRequest(url, {
    headers: { authorization: "Bearer test-token" },
  });
}

describe("validateGetArtistFansRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateAuthContext.mockResolvedValue({
      accountId: "auth-account",
      orgId: null,
      authToken: "test-token",
    });
  });

  it("returns 400 when id is invalid", async () => {
    const req = makeRequest("https://example.com/api/artists/not-a-uuid/fans");
    const result = await validateGetArtistFansRequest(req, "not-a-uuid");

    expect(result).toBeInstanceOf(NextResponse);
    const body = await (result as NextResponse).json();
    expect((result as NextResponse).status).toBe(400);
    expect(body.status).toBe("error");
    expect(body.error).toMatch(/id/i);
    expect(body.missing_fields).toEqual(["artistAccountId"]);
  });

  it("returns 401 from auth even when params are invalid", async () => {
    const unauthorized = NextResponse.json({ error: "unauthorized" }, { status: 401 });
    mockValidateAuthContext.mockResolvedValue(unauthorized);

    const req = new NextRequest("https://example.com/api/artists/not-a-uuid/fans?page=-1");
    const result = await validateGetArtistFansRequest(req, "not-a-uuid");

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
  });

  it("applies default page=1 and limit=20 when query params omitted", async () => {
    const req = makeRequest(`https://example.com/api/artists/${VALID_UUID}/fans`);
    const result = await validateGetArtistFansRequest(req, VALID_UUID);

    expect(result).not.toBeInstanceOf(NextResponse);
    if (!(result instanceof NextResponse)) {
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.artistAccountId).toBe(VALID_UUID);
    }
  });

  it("clamps limit > 100 down to 100", async () => {
    const req = makeRequest(`https://example.com/api/artists/${VALID_UUID}/fans?limit=500`);
    const result = await validateGetArtistFansRequest(req, VALID_UUID);

    expect(result).not.toBeInstanceOf(NextResponse);
    if (!(result instanceof NextResponse)) {
      expect(result.limit).toBe(100);
    }
  });

  it("rejects non-positive page values", async () => {
    const req = makeRequest(`https://example.com/api/artists/${VALID_UUID}/fans?page=0`);
    const result = await validateGetArtistFansRequest(req, VALID_UUID);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
    const body = await (result as NextResponse).json();
    expect(body.status).toBe("error");
    expect(body.missing_fields).toEqual(["page"]);
  });
});
