import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { getResearchLookupHandler } from "../getResearchLookupHandler";
import { validateGetResearchLookupRequest } from "../validateGetResearchLookupRequest";
import { handleResearch } from "../handleResearch";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("../validateGetResearchLookupRequest", () => ({
  validateGetResearchLookupRequest: vi.fn(),
}));

vi.mock("../handleResearch", () => ({
  handleResearch: vi.fn(),
}));

describe("getResearchLookupHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateGetResearchLookupRequest).mockResolvedValue({
      accountId: "test-id",
      spotifyId: "3TVXtAsR1Inumwj472S9r4",
    });
  });

  it("passes through validator error response", async () => {
    const err = NextResponse.json({ error: "bad" }, { status: 400 });
    vi.mocked(validateGetResearchLookupRequest).mockResolvedValue(err);
    const req = new NextRequest("http://localhost/api/research/lookup");
    const res = await getResearchLookupHandler(req);
    expect(res).toBe(err);
  });

  it("returns 'Lookup failed' on upstream error", async () => {
    vi.mocked(handleResearch).mockResolvedValue({
      error: "Request failed with status 502",
      status: 502,
    });
    const req = new NextRequest(
      "http://localhost/api/research/lookup?url=https://open.spotify.com/artist/3TVXtAsR1Inumwj472S9r4",
    );
    const res = await getResearchLookupHandler(req);
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe("Lookup failed");
  });

  it("wraps array responses in a data field instead of spreading indices", async () => {
    const arrayData = [
      { id: 1, platform: "spotify" },
      { id: 2, platform: "apple_music" },
    ];

    vi.mocked(handleResearch).mockResolvedValue({ data: arrayData });

    const req = new NextRequest(
      "http://localhost/api/research/lookup?url=https://open.spotify.com/artist/3TVXtAsR1Inumwj472S9r4",
    );
    const res = await getResearchLookupHandler(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("success");
    expect(body.data).toEqual(arrayData);
    expect(body).not.toHaveProperty("0");
  });

  it("spreads object responses normally", async () => {
    const objectData = { id: 3380, spotify_id: "3TVXtAsR1Inumwj472S9r4" };
    vi.mocked(handleResearch).mockResolvedValue({ data: objectData });

    const req = new NextRequest(
      "http://localhost/api/research/lookup?url=https://open.spotify.com/artist/3TVXtAsR1Inumwj472S9r4",
    );
    const res = await getResearchLookupHandler(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("success");
    expect(body.id).toBe(3380);
    expect(body.spotify_id).toBe("3TVXtAsR1Inumwj472S9r4");
  });
});
