import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateGetResearchPlaycountsRequest } from "../validateGetResearchPlaycountsRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { ensureResearchCredits } from "@/lib/research/ensureResearchCredits";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/research/ensureResearchCredits", () => ({ ensureResearchCredits: vi.fn() }));

const req = (qs: string) => new NextRequest(`http://x/api/research/playcounts${qs}`);

describe("validateGetResearchPlaycountsRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({ accountId: "acc_1" } as never);
    vi.mocked(ensureResearchCredits).mockResolvedValue(null as never);
  });

  it("returns accountId + spotifyAlbumId for a valid request", async () => {
    const result = await validateGetResearchPlaycountsRequest(
      req("?spotify_album_id=70Zkfb99ladZ3q0JVg97co"),
    );

    expect(result).toEqual({ accountId: "acc_1", spotifyAlbumId: "70Zkfb99ladZ3q0JVg97co" });
  });

  it("returns 400 when spotify_album_id is missing", async () => {
    const result = await validateGetResearchPlaycountsRequest(req(""));

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("short-circuits with the auth response", async () => {
    const denied = NextResponse.json({ status: "error" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(denied as never);

    const result = await validateGetResearchPlaycountsRequest(req("?spotify_album_id=x"));

    expect(result).toBe(denied);
  });

  it("short-circuits with the credits response", async () => {
    const short = NextResponse.json({ status: "error" }, { status: 402 });
    vi.mocked(ensureResearchCredits).mockResolvedValue(short as never);

    const result = await validateGetResearchPlaycountsRequest(req("?spotify_album_id=x"));

    expect(result).toBe(short);
  });
});
