import { describe, it, expect, vi, beforeEach } from "vitest";
import { RetryableError } from "workflow";
import { mapAndWriteChunkStep } from "../mapAndWriteChunkStep";

import { writeAlbumPlayCounts } from "@/lib/research/playcounts/writeAlbumPlayCounts";
import { SpotifyRateLimitError } from "@/lib/spotify/SpotifyRateLimitError";

vi.mock("@/lib/research/playcounts/writeAlbumPlayCounts", () => ({
  writeAlbumPlayCounts: vi.fn(),
}));

const PAYLOAD = { runId: "run_1", albums: [{ id: "a1", name: "A", tracks: [] }] };

describe("mapAndWriteChunkStep", () => {
  beforeEach(() => vi.clearAllMocks());

  it("maps + writes against the cached actor payload (no actor re-spend on retry)", async () => {
    vi.mocked(writeAlbumPlayCounts).mockResolvedValue(12);

    const written = await mapAndWriteChunkStep("snap_1", PAYLOAD);

    expect(writeAlbumPlayCounts).toHaveBeenCalledWith(PAYLOAD.albums, "run_1", {
      snapshotId: "snap_1",
    });
    expect(written).toBe(12);
  });

  it("escalates sustained Spotify rate limiting to a durable RetryableError", async () => {
    vi.mocked(writeAlbumPlayCounts).mockRejectedValue(new SpotifyRateLimitError());

    await expect(mapAndWriteChunkStep("snap_1", PAYLOAD)).rejects.toBeInstanceOf(RetryableError);
  });

  it("lets other failures propagate untyped (step retry/workflow catch handles them)", async () => {
    vi.mocked(writeAlbumPlayCounts).mockRejectedValue(new Error("db down"));

    await expect(mapAndWriteChunkStep("snap_1", PAYLOAD)).rejects.toThrow("db down");
  });
});
