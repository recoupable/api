import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { POST } from "../route";

vi.mock("@/lib/accounts/addArtistToAccountHandler", () => ({
  addArtistToAccountHandler: vi.fn(),
}));

const { addArtistToAccountHandler } = await import("@/lib/accounts/addArtistToAccountHandler");

const ARTIST_ID = "11111111-1111-4111-8111-111111111111";

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

  it("delegates to addArtistToAccountHandler and returns its response", async () => {
    const handlerResponse = NextResponse.json({ success: true }, { status: 200 });
    vi.mocked(addArtistToAccountHandler).mockResolvedValue(handlerResponse);

    const req = makeReq({ artistId: ARTIST_ID });
    const res = await POST(req);

    expect(addArtistToAccountHandler).toHaveBeenCalledWith(req);
    expect(res).toBe(handlerResponse);
  });
});
