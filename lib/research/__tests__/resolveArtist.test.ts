import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveArtist } from "../resolveArtist";

import { fetchSongstatsResearch } from "@/lib/research/songstats/fetchSongstatsResearch";

vi.mock("@/lib/research/songstats/fetchSongstatsResearch", () => ({
  fetchSongstatsResearch: vi.fn(),
}));

describe("resolveArtist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns numeric ID directly", async () => {
    const result = await resolveArtist("3380");

    expect(result).toEqual({ id: "3380" });
    expect(fetchSongstatsResearch).not.toHaveBeenCalled();
  });

  it("returns error for UUID (not yet implemented)", async () => {
    const result = await resolveArtist("de05ba8c-7e29-4f1a-93a7-3635653599f6");

    expect(result).toHaveProperty("error");
    expect(result.error).toContain("not yet implemented");
  });

  it("searches the configured provider by name and returns top match", async () => {
    vi.mocked(fetchSongstatsResearch).mockResolvedValue({
      data: { artists: [{ id: 3380, name: "Drake" }] },
      status: 200,
    });

    const result = await resolveArtist("Drake");

    expect(result).toEqual({ id: "3380" });
    expect(fetchSongstatsResearch).toHaveBeenCalledWith("/search", {
      q: "Drake",
      type: "artists",
      limit: "1",
    });
  });

  it("returns error when no artist found", async () => {
    vi.mocked(fetchSongstatsResearch).mockResolvedValue({
      data: { artists: [] },
      status: 200,
    });

    const result = await resolveArtist("xyznonexistent");

    expect(result).toHaveProperty("error");
    expect(result.error).toContain("No artist found");
  });

  it("returns error when search fails", async () => {
    vi.mocked(fetchSongstatsResearch).mockResolvedValue({
      data: { error: "failed" },
      status: 500,
    });

    const result = await resolveArtist("Drake");

    expect(result).toHaveProperty("error");
    expect(result.error).toContain("500");
  });

  it("returns error for empty string", async () => {
    const result = await resolveArtist("");

    expect(result).toHaveProperty("error");
    expect(result.error).toContain("required");
  });

  it("trims whitespace from input", async () => {
    const result = await resolveArtist("  3380  ");

    expect(result).toEqual({ id: "3380" });
  });

  it("returns SongStats string IDs from provider-backed search results", async () => {
    vi.mocked(fetchSongstatsResearch).mockResolvedValue({
      data: { artists: [{ id: "artist_123", name: "Test Artist" }] },
      status: 200,
    });

    const result = await resolveArtist("Test Artist");

    expect(result).toEqual({ id: "artist_123" });
  });
});
