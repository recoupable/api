import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getResearchPlaycountsHandler } from "../getResearchPlaycountsHandler";
import { validateGetResearchPlaycountsRequest } from "../validateGetResearchPlaycountsRequest";
import { getAlbumPlaycounts } from "../getAlbumPlaycounts";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));
vi.mock("../validateGetResearchPlaycountsRequest", () => ({
  validateGetResearchPlaycountsRequest: vi.fn(),
}));
vi.mock("../getAlbumPlaycounts", () => ({ getAlbumPlaycounts: vi.fn() }));

const req = () => new NextRequest("http://x/api/research/playcounts?spotify_album_id=a1");

describe("getResearchPlaycountsHandler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the playcounts payload on success", async () => {
    vi.mocked(validateGetResearchPlaycountsRequest).mockResolvedValue({
      accountId: "acc_1",
      spotifyAlbumId: "a1",
    });
    vi.mocked(getAlbumPlaycounts).mockResolvedValue({
      data: { status: "success", album: { spotify_album_id: "a1" }, playcounts: [] },
    });

    const res = await getResearchPlaycountsHandler(req());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: "success",
      album: { spotify_album_id: "a1" },
      playcounts: [],
    });
  });

  it("short-circuits with the validation response", async () => {
    vi.mocked(validateGetResearchPlaycountsRequest).mockResolvedValue(
      NextResponse.json({ status: "error" }, { status: 400 }),
    );

    const res = await getResearchPlaycountsHandler(req());

    expect(res.status).toBe(400);
    expect(getAlbumPlaycounts).not.toHaveBeenCalled();
  });

  it("maps error results to error responses", async () => {
    vi.mocked(validateGetResearchPlaycountsRequest).mockResolvedValue({
      accountId: "acc_1",
      spotifyAlbumId: "a1",
    });
    vi.mocked(getAlbumPlaycounts).mockResolvedValue({ error: "No snapshot", status: 404 });

    const res = await getResearchPlaycountsHandler(req());

    expect(res.status).toBe(404);
  });

  it("returns 500 on unexpected errors", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(validateGetResearchPlaycountsRequest).mockRejectedValue(new Error("boom"));

    const res = await getResearchPlaycountsHandler(req());

    expect(res.status).toBe(500);
    consoleError.mockRestore();
  });
});
