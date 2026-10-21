import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET } from "@/app/api/research/audience/route";
import { validateArtistRequest } from "../validateArtistRequest";
import { handleArtistResearch } from "../handleArtistResearch";

vi.mock("@/lib/research/validateArtistRequest", () => ({ validateArtistRequest: vi.fn() }));
vi.mock("@/lib/research/handleArtistResearch", () => ({ handleArtistResearch: vi.fn() }));
const request = (platform?: string) =>
  new NextRequest(
    `http://localhost/api/research/audience?artist=Fixture${platform === undefined ? "" : `&platform=${encodeURIComponent(platform)}`}`,
  );
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(validateArtistRequest).mockResolvedValue({
    accountId: "fixture",
    artist: "Fixture",
    artistId: "fixture-id",
  });
  vi.mocked(handleArtistResearch).mockResolvedValue({ data: { audience: [] } });
});

describe("audience platform validation through exported GET", () => {
  it.each(["myspace", "../admin", "toString", "__proto__", "constructor", "instagram/extra"])(
    "rejects unsupported platform %s before the credit/auth gate or research",
    async platform => {
      const response = await GET(request(platform));
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        status: "error",
        error: expect.stringContaining("Invalid platform"),
      });
      expect(validateArtistRequest).not.toHaveBeenCalled();
      expect(handleArtistResearch).not.toHaveBeenCalled();
    },
  );
  it.each([undefined, "", "  "])("uses the Instagram default for %j", async platform => {
    const response = await GET(request(platform));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "success", audience: [] });
    const args = vi.mocked(handleArtistResearch).mock.calls[0][0];
    expect(args.path("fixture-id")).toBe("/artist/fixture-id/instagram-audience-stats");
  });
  it.each([
    "bandsintown",
    "deezer",
    "facebook",
    "instagram",
    "line",
    "melon",
    "soundcloud",
    "spotify",
    "tiktok",
    "twitch",
    "twitter",
    "wikipedia",
    "youtube_artist",
    "youtube_channel",
  ])("retains the existing supported platform %s", async platform => {
    const response = await GET(request(platform));
    expect(response.status).toBe(200);
    expect(vi.mocked(handleArtistResearch).mock.calls[0][0].path("fixture-id")).toBe(
      `/artist/fixture-id/${platform}-audience-stats`,
    );
  });
  it("trims a supported platform and preserves identity and billing attribution", async () => {
    const response = await GET(request(" spotify "));
    expect(response.status).toBe(200);
    const args = vi.mocked(handleArtistResearch).mock.calls[0][0];
    expect(args).toMatchObject({
      accountId: "fixture",
      artist: "Fixture",
      artistId: "fixture-id",
      modelId: "GET /api/research/audience",
    });
    expect(args.path("fixture-id")).toBe("/artist/fixture-id/spotify-audience-stats");
  });
  it("preserves the existing auth/credit denial on valid platforms", async () => {
    vi.mocked(validateArtistRequest).mockResolvedValue(
      NextResponse.json({ status: "error", error: "fixture denial" }, { status: 402 }),
    );
    const response = await GET(request("instagram"));
    expect(response.status).toBe(402);
    expect(handleArtistResearch).not.toHaveBeenCalled();
  });
  it("preserves failed research status/body", async () => {
    vi.mocked(handleArtistResearch).mockResolvedValue({ error: "fixture failure", status: 429 });
    const response = await GET(request("spotify"));
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ status: "error", error: "fixture failure" });
  });
});
