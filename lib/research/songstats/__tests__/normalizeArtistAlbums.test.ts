import { describe, expect, it } from "vitest";

import { normalizeArtistAlbums } from "../normalizeArtistAlbums";

describe("normalizeArtistAlbums", () => {
  it("filters remix rows when is_primary defaults to true", () => {
    const data = {
      catalog: [
        { title: "Views", songstats_track_id: "a1" },
        { title: "One Dance (Remix)", songstats_track_id: "a2" },
      ],
    };

    const albums = normalizeArtistAlbums(data, { isPrimary: "true" });

    expect(albums).toHaveLength(1);
    expect(albums[0]).toMatchObject({ title: "Views", id: "a1" });
  });

  it("keeps remix rows when is_primary=false", () => {
    const data = {
      catalog: [
        { title: "Views", songstats_track_id: "a1" },
        { title: "One Dance (Remix)", songstats_track_id: "a2" },
      ],
    };

    const albums = normalizeArtistAlbums(data, { isPrimary: "false" });

    expect(albums).toHaveLength(2);
  });
});
