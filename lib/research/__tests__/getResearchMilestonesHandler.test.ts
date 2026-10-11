import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getResearchMilestonesHandler } from "../getResearchMilestonesHandler";
import { validateArtistRequest } from "../validateArtistRequest";
import { fetchSongstats } from "@/lib/songstats/fetchSongstats";
import { recordCreditDeduction } from "@/lib/credits/recordCreditDeduction";

vi.mock("../validateArtistRequest", () => ({ validateArtistRequest: vi.fn() }));
vi.mock("@/lib/songstats/fetchSongstats", () => ({ fetchSongstats: vi.fn() }));
vi.mock("@/lib/credits/recordCreditDeduction", () => ({ recordCreditDeduction: vi.fn() }));
vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: () => ({}) }));

describe("getResearchMilestonesHandler with the Songstats adapter", () => {
  const request = () =>
    new NextRequest("https://api.recoupable.dev/api/research/milestones?id=artist_123");

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateArtistRequest).mockResolvedValue({
      accountId: "account_123",
      artist: "artist_123",
      artistId: "artist_123",
    });
    vi.mocked(recordCreditDeduction).mockResolvedValue({ success: true });
  });

  it("preserves provider activity entries through the real mapper and success envelope", async () => {
    const activities = [
      { source: "spotify", activity_text: "Added to a playlist", activity_date: "2026-10-10" },
    ];
    vi.mocked(fetchSongstats).mockResolvedValue({ status: 200, data: { activities } });

    const response = await getResearchMilestonesHandler(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "success", milestones: activities });
    expect(fetchSongstats).toHaveBeenCalledWith("/artists/activities", {
      songstats_artist_id: "artist_123",
    });
    expect(recordCreditDeduction).toHaveBeenCalledWith({
      accountId: "account_123",
      creditsToDeduct: 50_000,
      source: "api",
      modelId: "GET /api/research/milestones",
    });
  });

  it("preserves an empty provider feed", async () => {
    vi.mocked(fetchSongstats).mockResolvedValue({ status: 200, data: { activities: [] } });
    expect(await (await getResearchMilestonesHandler(request())).json()).toEqual({
      status: "success",
      milestones: [],
    });
  });

  it("surfaces a provider rate limit without charging", async () => {
    vi.mocked(fetchSongstats).mockResolvedValue({ status: 429, data: { error: "rate limited" } });
    const response = await getResearchMilestonesHandler(request());
    expect(response.status).toBe(429);
    expect((await response.json()).error).toBe("Request failed with status 429");
    expect(recordCreditDeduction).not.toHaveBeenCalled();
  });

  it("short-circuits validation before contacting the provider", async () => {
    const rejected = NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
    vi.mocked(validateArtistRequest).mockResolvedValue(rejected);
    expect(await getResearchMilestonesHandler(request())).toBe(rejected);
    expect(fetchSongstats).not.toHaveBeenCalled();
    expect(recordCreditDeduction).not.toHaveBeenCalled();
  });
});
