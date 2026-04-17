import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { getArtistSocialsHandler } from "../getArtistSocialsHandler";
import { getArtistSocials } from "../getArtistSocials";
import { validateGetArtistSocialsRequest } from "../validateGetArtistSocialsRequest";

vi.mock("../getArtistSocials", () => ({ getArtistSocials: vi.fn() }));
vi.mock("../validateGetArtistSocialsRequest", () => ({ validateGetArtistSocialsRequest: vi.fn() }));
vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: () => ({}) }));

const ARTIST_ID = "550e8400-e29b-41d4-a716-446655440000";
const request = new NextRequest(`http://localhost/api/artists/${ARTIST_ID}/socials`);
const validated = {
  artist_account_id: ARTIST_ID,
  page: 1,
  limit: 20,
  authContext: { accountId: "acct", authToken: "t", orgId: null },
};
const okBody = {
  status: "success" as const,
  socials: [],
  pagination: { total_count: 0, page: 1, limit: 20, total_pages: 0 },
};

describe("getArtistSocialsHandler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the validator's response on failure", async () => {
    const err = NextResponse.json({}, { status: 401 });
    vi.mocked(validateGetArtistSocialsRequest).mockResolvedValue(err);
    expect(await getArtistSocialsHandler(request, ARTIST_ID)).toBe(err);
    expect(getArtistSocials).not.toHaveBeenCalled();
  });

  it("returns 200 on success", async () => {
    vi.mocked(validateGetArtistSocialsRequest).mockResolvedValue(validated);
    vi.mocked(getArtistSocials).mockResolvedValue(okBody);
    const res = await getArtistSocialsHandler(request, ARTIST_ID);
    expect(res.status).toBe(200);
    expect(getArtistSocials).toHaveBeenCalledWith({
      artist_account_id: ARTIST_ID,
      page: 1,
      limit: 20,
    });
    expect(await res.json()).toEqual(okBody);
  });

  it("returns 500 when getArtistSocials reports error", async () => {
    vi.mocked(validateGetArtistSocialsRequest).mockResolvedValue(validated);
    vi.mocked(getArtistSocials).mockResolvedValue({ ...okBody, status: "error", message: "x" });
    const res = await getArtistSocialsHandler(request, ARTIST_ID);
    expect(res.status).toBe(500);
  });
});
