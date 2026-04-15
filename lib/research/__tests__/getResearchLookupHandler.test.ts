import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

import { getResearchLookupHandler } from "../getResearchLookupHandler";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { fetchChartmetric } from "@/lib/chartmetric/fetchChartmetric";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/chartmetric/fetchChartmetric", () => ({
  fetchChartmetric: vi.fn(),
}));

vi.mock("@/lib/credits/deductCredits", () => ({
  deductCredits: vi.fn(),
}));

describe("getResearchLookupHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "test-id",
      orgId: null,
      authToken: "token",
    });
  });

  it("returns 400 when url is missing", async () => {
    const req = new NextRequest("http://localhost/api/research/lookup");
    const res = await getResearchLookupHandler(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when url is not a Spotify artist URL", async () => {
    const req = new NextRequest("http://localhost/api/research/lookup?url=https://google.com");
    const res = await getResearchLookupHandler(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Spotify artist URL");
  });

  it("wraps array responses in a data field instead of spreading indices", async () => {
    const arrayData = [
      { id: 1, platform: "spotify" },
      { id: 2, platform: "apple_music" },
    ];

    vi.mocked(fetchChartmetric).mockResolvedValue({
      data: arrayData,
      status: 200,
    });

    const req = new NextRequest(
      "http://localhost/api/research/lookup?url=https://open.spotify.com/artist/3TVXtAsR1Inumwj472S9r4",
    );
    const res = await getResearchLookupHandler(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("success");
    // Should wrap in data field, NOT spread as {"0":...,"1":...}
    expect(body.data).toEqual(arrayData);
    expect(body).not.toHaveProperty("0");
  });

  it("spreads object responses normally", async () => {
    const objectData = { id: 3380, spotify_id: "3TVXtAsR1Inumwj472S9r4" };

    vi.mocked(fetchChartmetric).mockResolvedValue({
      data: objectData,
      status: 200,
    });

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
