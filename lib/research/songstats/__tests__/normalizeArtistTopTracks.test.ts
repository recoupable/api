import { describe, expect, it } from "vitest";

import { normalizeArtistTopTracks } from "../normalizeArtistTopTracks";

describe("normalizeArtistTopTracks", () => {
  it("ignores platform shells when top_tracks is missing", () => {
    const data = {
      data: [
        {
          source: "spotify",
          metric: null,
          metric_options: ["popularity", "playlists"],
        },
      ],
    };

    expect(normalizeArtistTopTracks(data)).toEqual([]);
  });

  it("flattens nested top_tracks and filters remix titles", () => {
    const data = {
      data: [
        {
          source: "spotify",
          top_tracks: [
            { title: "God's Plan", songstats_track_id: "tr_1" },
            { title: "Nice For What (Remix)", songstats_track_id: "tr_2" },
          ],
        },
      ],
    };

    const tracks = normalizeArtistTopTracks(data);

    expect(tracks).toHaveLength(1);
    expect(tracks[0]).toMatchObject({ title: "God's Plan", id: "tr_1" });
  });
});
