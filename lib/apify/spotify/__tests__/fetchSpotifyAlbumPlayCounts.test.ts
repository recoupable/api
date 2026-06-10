import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchSpotifyAlbumPlayCounts } from "../fetchSpotifyAlbumPlayCounts";

import apifyClient from "@/lib/apify/client";

vi.mock("@/lib/apify/client", () => {
  return { default: { actor: vi.fn(), dataset: vi.fn() } };
});

const ITEMS = [
  {
    name: "K.I.D.S. (Deluxe)",
    label: "Rostrum Records",
    copyright: "℗ 2020 Rostrum Records",
    tracks: [
      { id: "track_a", name: "The Spins", streamCount: 1331384578, duration: 181000 },
      { id: "track_b", name: "Nikes on My Feet", streamCount: 322000000, duration: 192000 },
    ],
  },
];

describe("fetchSpotifyAlbumPlayCounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls the play-count actor with album URLs and returns parsed items + runId", async () => {
    const call = vi
      .fn()
      .mockResolvedValue({ id: "run_1", defaultDatasetId: "ds_1", status: "SUCCEEDED" });
    vi.mocked(apifyClient.actor).mockReturnValue({ call } as never);
    const listItems = vi.fn().mockResolvedValue({ items: ITEMS });
    vi.mocked(apifyClient.dataset).mockReturnValue({ listItems } as never);

    const result = await fetchSpotifyAlbumPlayCounts(["5SKnXCvB4fcGSZu32o3LRY"]);

    expect(apifyClient.actor).toHaveBeenCalledWith("beatanalytics~spotify-play-count-scraper");
    expect(call).toHaveBeenCalledWith({
      urls: [{ url: "https://open.spotify.com/album/5SKnXCvB4fcGSZu32o3LRY" }],
    });
    expect(apifyClient.dataset).toHaveBeenCalledWith("ds_1");
    expect(result).toEqual({ runId: "run_1", albums: ITEMS });
  });

  it("throws when the run fails", async () => {
    const call = vi
      .fn()
      .mockResolvedValue({ id: "run_2", defaultDatasetId: "ds_2", status: "FAILED" });
    vi.mocked(apifyClient.actor).mockReturnValue({ call } as never);

    await expect(fetchSpotifyAlbumPlayCounts(["bad_album"])).rejects.toThrow(
      "Spotify play-count actor run failed with status FAILED",
    );
  });

  it("throws on empty input", async () => {
    await expect(fetchSpotifyAlbumPlayCounts([])).rejects.toThrow(
      "At least one Spotify album id is required",
    );
    expect(apifyClient.actor).not.toHaveBeenCalled();
  });
});
