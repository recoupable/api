import { describe, expect, it } from "vitest";

import { buildArtistTopTracksQuery } from "../buildArtistTopTracksQuery";

describe("buildArtistTopTracksQuery", () => {
  it("defaults source and metric", () => {
    expect(buildArtistTopTracksQuery("artist_1")).toMatchObject({
      songstats_artist_id: "artist_1",
      source: "spotify",
      metric: "popularity",
    });
  });

  it("does not allow query params to override the route artist id", () => {
    const params = buildArtistTopTracksQuery("artist_1", {
      songstats_artist_id: "other_artist",
      limit: "10",
    });

    expect(params.songstats_artist_id).toBe("artist_1");
    expect(params.limit).toBe("10");
  });
});
