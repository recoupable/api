import { describe, it, expect, vi, beforeEach } from "vitest";
import { captureSnapshotChunkStep } from "../captureSnapshotChunkStep";

import { fetchSpotifyAlbumPlayCounts } from "@/lib/apify/spotify/fetchSpotifyAlbumPlayCounts";
import { writeAlbumPlayCounts } from "@/lib/research/playcounts/writeAlbumPlayCounts";

vi.mock("@/lib/apify/spotify/fetchSpotifyAlbumPlayCounts", () => ({
  fetchSpotifyAlbumPlayCounts: vi.fn(),
}));
vi.mock("@/lib/research/playcounts/writeAlbumPlayCounts", () => ({
  writeAlbumPlayCounts: vi.fn(),
}));

describe("captureSnapshotChunkStep", () => {
  beforeEach(() => vi.clearAllMocks());

  it("captures a chunk and writes measurements with snapshot lineage", async () => {
    vi.mocked(fetchSpotifyAlbumPlayCounts).mockResolvedValue({
      runId: "run_7",
      albums: [{ name: "A", tracks: [] }],
    });
    vi.mocked(writeAlbumPlayCounts).mockResolvedValue(12);

    const written = await captureSnapshotChunkStep("snap_1", ["a1", "a2"]);

    expect(fetchSpotifyAlbumPlayCounts).toHaveBeenCalledWith(["a1", "a2"]);
    expect(writeAlbumPlayCounts).toHaveBeenCalledWith([{ name: "A", tracks: [] }], "run_7", {
      snapshotId: "snap_1",
    });
    expect(written).toBe(12);
  });
});
