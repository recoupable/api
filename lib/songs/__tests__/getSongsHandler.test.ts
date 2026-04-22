import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { getSongsHandler } from "../getSongsHandler";

const mockValidateAuthContext = vi.fn();
const mockSelectSongsWithArtists = vi.fn();

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: (...args: unknown[]) => mockValidateAuthContext(...args),
}));
vi.mock("@/lib/supabase/songs/selectSongsWithArtists", () => ({
  selectSongsWithArtists: (...args: unknown[]) => mockSelectSongsWithArtists(...args),
}));
vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

const UUID = "11111111-1111-4111-8111-111111111111";
const makeReq = (url: string) => new NextRequest(url, { headers: { authorization: "Bearer t" } });

describe("getSongsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateAuthContext.mockResolvedValue({ accountId: "a", orgId: null });
    mockSelectSongsWithArtists.mockResolvedValue([]);
  });

  it.each([
    ["isrc=USRC17607839", { isrc: "USRC17607839" }],
    [`artist_account_id=${UUID}`, { artist_account_id: UUID }],
    ["", {}],
  ])("200 with query %s", async (qs, expected) => {
    const res = await getSongsHandler(makeReq(`https://x/api/songs?${qs}`));
    expect(res.status).toBe(200);
    expect(mockSelectSongsWithArtists).toHaveBeenCalledWith(expected);
  });

  it("401 on auth failure", async () => {
    mockValidateAuthContext.mockResolvedValueOnce(
      NextResponse.json({ status: "error" }, { status: 401 }),
    );
    const res = await getSongsHandler(new NextRequest("https://x/api/songs"));
    expect(res.status).toBe(401);
    expect(mockSelectSongsWithArtists).not.toHaveBeenCalled();
  });

  it("400 on invalid artist_account_id", async () => {
    const res = await getSongsHandler(makeReq("https://x/api/songs?artist_account_id=bad"));
    expect(res.status).toBe(400);
    expect(mockSelectSongsWithArtists).not.toHaveBeenCalled();
  });

  it("500 returns a generic error string, never the raw message", async () => {
    mockSelectSongsWithArtists.mockRejectedValue(new Error("db down at 10.0.0.1:5432"));
    const res = await getSongsHandler(makeReq("https://x/api/songs?isrc=X"));
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error).toBe("Internal server error");
    expect(JSON.stringify(body)).not.toMatch(/db down|10\.0\.0\.1/);
  });
});
