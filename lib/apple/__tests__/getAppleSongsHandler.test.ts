import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getAppleSongsHandler } from "../getAppleSongsHandler";

const mockValidate = vi.fn();
const mockGetSongs = vi.fn();

vi.mock("../validateGetAppleSongsRequest", () => ({
  validateGetAppleSongsRequest: (...args: unknown[]) => mockValidate(...args),
}));
vi.mock("../getAppleSongsByIsrc", () => ({
  getAppleSongsByIsrc: (...args: unknown[]) => mockGetSongs(...args),
}));

const request = new NextRequest("https://api.recoupable.dev/api/apple/songs?isrc=DEH742611917");

describe("getAppleSongsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidate.mockResolvedValue({
      accountId: "acct-1",
      isrcs: ["DEH742611917"],
      storefront: "us",
    });
  });

  it("returns the documented success envelope with the storefront and results", async () => {
    const results = [{ isrc: "DEH742611917", found: true, songs: [{ id: "1894880802" }] }];
    mockGetSongs.mockResolvedValue({ results, error: null });

    const response = await getAppleSongsHandler(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "success",
      storefront: "us",
      results,
    });
  });

  it("passes the validated isrcs and storefront through to the lookup", async () => {
    mockGetSongs.mockResolvedValue({ results: [], error: null });

    await getAppleSongsHandler(request);

    expect(mockGetSongs).toHaveBeenCalledWith({ isrcs: ["DEH742611917"], storefront: "us" });
  });

  it("short-circuits with the validation response when validation fails", async () => {
    const badRequest = NextResponse.json({ status: "error" }, { status: 400 });
    mockValidate.mockResolvedValue(badRequest);

    expect(await getAppleSongsHandler(request)).toBe(badRequest);
    expect(mockGetSongs).not.toHaveBeenCalled();
  });

  it("returns a 500 when Apple cannot be reached", async () => {
    mockGetSongs.mockResolvedValue({ results: null, error: new Error("Apple down") });

    const response = await getAppleSongsHandler(request);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ status: "error" });
  });

  // A missing credential throws out of generateDeveloperToken; it must not leak.
  it("does not echo the upstream error message to the client", async () => {
    mockGetSongs.mockResolvedValue({
      results: null,
      error: new Error("APPLE_MUSIC_PRIVATE_KEY is not set"),
    });

    const body = await (await getAppleSongsHandler(request)).json();

    expect(JSON.stringify(body)).not.toContain("APPLE_MUSIC_PRIVATE_KEY");
  });
});
