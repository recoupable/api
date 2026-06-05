import { describe, it, expect, vi, beforeEach } from "vitest";

import { handleArtistResearch } from "../handleArtistResearch";
import { resolveArtist } from "@/lib/research/resolveArtist";
import { fetchSongstatsResearch } from "@/lib/research/songstats/fetchSongstatsResearch";
import { recordCreditDeduction } from "@/lib/credits/recordCreditDeduction";

vi.mock("@/lib/credits/ensureCreditsOrShortCircuit", () => ({
  ensureCreditsOrShortCircuit: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/research/resolveArtist", () => ({
  resolveArtist: vi.fn(),
}));
vi.mock("@/lib/research/songstats/fetchSongstatsResearch", () => ({
  fetchSongstatsResearch: vi.fn(),
}));
vi.mock("@/lib/credits/recordCreditDeduction", () => ({
  recordCreditDeduction: vi.fn(),
}));

describe("handleArtistResearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns { error, status: 404 } when artist cannot be resolved", async () => {
    vi.mocked(resolveArtist).mockResolvedValue({ error: "Artist not found" } as never);

    const result = await handleArtistResearch({
      artist: "Unknown",
      accountId: "acc_1",
      path: id => `/artist/${id}/albums`,
    });

    expect(result).toEqual({ error: "Artist not found", status: 404 });
    expect(fetchSongstatsResearch).not.toHaveBeenCalled();
    expect(recordCreditDeduction).not.toHaveBeenCalled();
  });

  it("proxies to the built path and returns { data } on success", async () => {
    vi.mocked(resolveArtist).mockResolvedValue({ id: "42" } as never);
    vi.mocked(fetchSongstatsResearch).mockResolvedValue({
      status: 200,
      data: [{ name: "a" }],
    } as never);
    vi.mocked(recordCreditDeduction).mockResolvedValue(undefined as never);

    const result = await handleArtistResearch({
      artist: "Drake",
      accountId: "acc_1",
      path: id => `/artist/${id}/albums`,
    });

    expect(fetchSongstatsResearch).toHaveBeenCalledWith("/artist/42/albums", undefined);
    expect(recordCreditDeduction).toHaveBeenCalledWith({
      accountId: "acc_1",
      creditsToDeduct: 5,
      source: "api",
    });
    expect(result).toEqual({ data: [{ name: "a" }] });
  });

  it("forwards query params to the provider fetcher", async () => {
    vi.mocked(resolveArtist).mockResolvedValue({ id: "7" } as never);
    vi.mocked(fetchSongstatsResearch).mockResolvedValue({ status: 200, data: {} } as never);

    await handleArtistResearch({
      artist: "X",
      accountId: "acc_1",
      path: id => `/artist/${id}/playlists`,
      query: { limit: "10", platform: "spotify" },
    });

    expect(fetchSongstatsResearch).toHaveBeenCalledWith("/artist/7/playlists", {
      limit: "10",
      platform: "spotify",
    });
  });

  it("returns the upstream status as an error when proxy is non-200", async () => {
    vi.mocked(resolveArtist).mockResolvedValue({ id: "1" } as never);
    vi.mocked(fetchSongstatsResearch).mockResolvedValue({ status: 502, data: null } as never);

    const result = await handleArtistResearch({
      artist: "X",
      accountId: "acc_1",
      path: id => `/artist/${id}/x`,
    });

    expect(result).toEqual({ error: "Request failed with status 502", status: 502 });
    expect(recordCreditDeduction).not.toHaveBeenCalled();
  });

  it("swallows credit-deduction failures and still returns data", async () => {
    vi.mocked(resolveArtist).mockResolvedValue({ id: "1" } as never);
    vi.mocked(fetchSongstatsResearch).mockResolvedValue({ status: 200, data: "ok" } as never);
    vi.mocked(recordCreditDeduction).mockRejectedValue(new Error("DB down"));

    const result = await handleArtistResearch({
      artist: "X",
      accountId: "acc_1",
      path: () => "/x",
    });

    expect(result).toEqual({ data: "ok" });
  });

  it("uses an explicit provider artist id without resolving by name", async () => {
    vi.mocked(fetchSongstatsResearch).mockResolvedValue({ status: 200, data: "ok" } as never);
    vi.mocked(recordCreditDeduction).mockResolvedValue(undefined as never);

    const result = await handleArtistResearch({
      artist: "artist_123",
      artistId: "artist_123",
      accountId: "acc_1",
      path: id => `/artist/${id}`,
    });

    expect(resolveArtist).not.toHaveBeenCalled();
    expect(fetchSongstatsResearch).toHaveBeenCalledWith("/artist/artist_123", undefined);
    expect(result).toEqual({ data: "ok" });
  });
});
