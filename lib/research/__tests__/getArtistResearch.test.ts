import { describe, it, expect, vi, beforeEach } from "vitest";

import { getArtistResearch } from "../getArtistResearch";
import { resolveArtist } from "@/lib/research/resolveArtist";
import { proxyToChartmetric } from "@/lib/research/proxyToChartmetric";
import { deductCredits } from "@/lib/credits/deductCredits";

vi.mock("@/lib/research/resolveArtist", () => ({
  resolveArtist: vi.fn(),
}));
vi.mock("@/lib/research/proxyToChartmetric", () => ({
  proxyToChartmetric: vi.fn(),
}));
vi.mock("@/lib/credits/deductCredits", () => ({
  deductCredits: vi.fn(),
}));

describe("getArtistResearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns { error, status: 404 } when artist cannot be resolved", async () => {
    vi.mocked(resolveArtist).mockResolvedValue({ error: "Artist not found" } as never);

    const result = await getArtistResearch({
      artist: "Unknown",
      accountId: "acc_1",
      path: id => `/artist/${id}/albums`,
    });

    expect(result).toEqual({ error: "Artist not found", status: 404 });
    expect(proxyToChartmetric).not.toHaveBeenCalled();
    expect(deductCredits).not.toHaveBeenCalled();
  });

  it("proxies to the built path and returns { data } on success", async () => {
    vi.mocked(resolveArtist).mockResolvedValue({ id: 42 } as never);
    vi.mocked(proxyToChartmetric).mockResolvedValue({
      status: 200,
      data: [{ name: "a" }],
    } as never);
    vi.mocked(deductCredits).mockResolvedValue(undefined as never);

    const result = await getArtistResearch({
      artist: "Drake",
      accountId: "acc_1",
      path: id => `/artist/${id}/albums`,
    });

    expect(proxyToChartmetric).toHaveBeenCalledWith("/artist/42/albums", undefined);
    expect(deductCredits).toHaveBeenCalledWith({ accountId: "acc_1", creditsToDeduct: 5 });
    expect(result).toEqual({ data: [{ name: "a" }] });
  });

  it("forwards query params to proxyToChartmetric", async () => {
    vi.mocked(resolveArtist).mockResolvedValue({ id: 7 } as never);
    vi.mocked(proxyToChartmetric).mockResolvedValue({ status: 200, data: {} } as never);

    await getArtistResearch({
      artist: "X",
      accountId: "acc_1",
      path: id => `/artist/${id}/playlists`,
      query: { limit: "10", platform: "spotify" },
    });

    expect(proxyToChartmetric).toHaveBeenCalledWith("/artist/7/playlists", {
      limit: "10",
      platform: "spotify",
    });
  });

  it("returns the upstream status as an error when proxy is non-200", async () => {
    vi.mocked(resolveArtist).mockResolvedValue({ id: 1 } as never);
    vi.mocked(proxyToChartmetric).mockResolvedValue({ status: 502, data: null } as never);

    const result = await getArtistResearch({
      artist: "X",
      accountId: "acc_1",
      path: id => `/artist/${id}/x`,
    });

    expect(result).toEqual({ error: "Request failed with status 502", status: 502 });
    expect(deductCredits).not.toHaveBeenCalled();
  });

  it("swallows credit-deduction failures and still returns data", async () => {
    vi.mocked(resolveArtist).mockResolvedValue({ id: 1 } as never);
    vi.mocked(proxyToChartmetric).mockResolvedValue({ status: 200, data: "ok" } as never);
    vi.mocked(deductCredits).mockRejectedValue(new Error("DB down"));

    const result = await getArtistResearch({
      artist: "X",
      accountId: "acc_1",
      path: () => "/x",
    });

    expect(result).toEqual({ data: "ok" });
  });
});
