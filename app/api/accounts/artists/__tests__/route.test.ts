import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { POST } from "../route";

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/accounts/resolveAddArtistAccountId", () => ({
  resolveAddArtistAccountId: vi.fn(),
}));

vi.mock("@/lib/accounts/addArtistToAccountHandler", () => ({
  addArtistToAccountHandler: vi.fn(),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

const { validateAuthContext } = await import("@/lib/auth/validateAuthContext");
const { resolveAddArtistAccountId } = await import("@/lib/accounts/resolveAddArtistAccountId");
const { addArtistToAccountHandler } = await import("@/lib/accounts/addArtistToAccountHandler");

const ARTIST_ID = "11111111-1111-4111-8111-111111111111";
const AUTH_ACCOUNT_ID = "22222222-2222-4222-8222-222222222222";

function makeReq(body: Record<string, unknown>): NextRequest {
  return new NextRequest("https://example.com/api/accounts/artists", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/accounts/artists", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no credential is provided", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ status: "error" }, { status: 401 }),
    );

    const res = await POST(makeReq({ artistId: ARTIST_ID }));

    expect(res.status).toBe(401);
    expect(addArtistToAccountHandler).not.toHaveBeenCalled();
  });

  it("returns 400 when artistId is missing", async () => {
    const res = await POST(makeReq({}));

    expect(res.status).toBe(400);
    expect(addArtistToAccountHandler).not.toHaveBeenCalled();
  });

  it("derives the account from the authenticated credential", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: AUTH_ACCOUNT_ID,
      orgId: null,
      authToken: "token",
    });
    vi.mocked(resolveAddArtistAccountId).mockResolvedValue(AUTH_ACCOUNT_ID);
    vi.mocked(addArtistToAccountHandler).mockResolvedValue(
      NextResponse.json({ success: true }, { status: 200 }),
    );

    const res = await POST(makeReq({ artistId: ARTIST_ID }));

    expect(res.status).toBe(200);
    expect(resolveAddArtistAccountId).toHaveBeenCalledWith(AUTH_ACCOUNT_ID, undefined);
    expect(addArtistToAccountHandler).toHaveBeenCalledWith({
      accountId: AUTH_ACCOUNT_ID,
      artistId: ARTIST_ID,
    });
  });

  it("returns the resolver error when email override is denied", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: AUTH_ACCOUNT_ID,
      orgId: null,
      authToken: "token",
    });
    vi.mocked(resolveAddArtistAccountId).mockResolvedValue(
      NextResponse.json({ status: "error" }, { status: 403 }),
    );

    const res = await POST(makeReq({ artistId: ARTIST_ID, email: "other@example.com" }));

    expect(res.status).toBe(403);
    expect(addArtistToAccountHandler).not.toHaveBeenCalled();
  });
});
