import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { addArtistToAccountHandler } from "../addArtistToAccountHandler";

vi.mock("@/lib/accounts/validateAddArtistRequest", () => ({
  validateAddArtistRequest: vi.fn(),
}));

vi.mock("@/lib/accounts/linkArtistToAccount", () => ({
  linkArtistToAccount: vi.fn(),
}));

const { validateAddArtistRequest } = await import("@/lib/accounts/validateAddArtistRequest");
const { linkArtistToAccount } = await import("@/lib/accounts/linkArtistToAccount");

const ARTIST_ID = "11111111-1111-4111-8111-111111111111";
const ACCOUNT_ID = "22222222-2222-4222-8222-222222222222";

function makeReq(body: Record<string, unknown>): NextRequest {
  return new NextRequest("https://example.com/api/accounts/artists", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("addArtistToAccountHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the validation error and does not link when validation fails", async () => {
    vi.mocked(validateAddArtistRequest).mockResolvedValue(
      NextResponse.json({ status: "error" }, { status: 401 }),
    );

    const res = await addArtistToAccountHandler(makeReq({ artistId: ARTIST_ID }));

    expect(res.status).toBe(401);
    expect(linkArtistToAccount).not.toHaveBeenCalled();
  });

  it("links the resolved account and artist when validation passes", async () => {
    vi.mocked(validateAddArtistRequest).mockResolvedValue({
      accountId: ACCOUNT_ID,
      artistId: ARTIST_ID,
    });
    vi.mocked(linkArtistToAccount).mockResolvedValue(
      NextResponse.json({ success: true }, { status: 200 }),
    );

    const res = await addArtistToAccountHandler(makeReq({ artistId: ARTIST_ID }));

    expect(res.status).toBe(200);
    expect(linkArtistToAccount).toHaveBeenCalledWith({
      accountId: ACCOUNT_ID,
      artistId: ARTIST_ID,
    });
  });
});
