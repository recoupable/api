import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchChunkStep } from "../fetchChunkStep";

import { fetchSpotifyAlbumPlayCounts } from "@/lib/apify/spotify/fetchSpotifyAlbumPlayCounts";

vi.mock("@/lib/apify/spotify/fetchSpotifyAlbumPlayCounts", () => ({
  fetchSpotifyAlbumPlayCounts: vi.fn(),
}));

describe("fetchChunkStep", () => {
  beforeEach(() => vi.clearAllMocks());

  it("runs the actor for the chunk and returns the serializable payload", async () => {
    const payload = { runId: "run_1", albums: [{ id: "a1", name: "A", tracks: [] }] };
    vi.mocked(fetchSpotifyAlbumPlayCounts).mockResolvedValue(payload);

    const result = await fetchChunkStep(["a1", "a2"]);

    expect(fetchSpotifyAlbumPlayCounts).toHaveBeenCalledWith(["a1", "a2"]);
    expect(result).toEqual(payload);
  });
});
