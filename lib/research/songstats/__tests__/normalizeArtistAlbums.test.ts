import { describe, expect, it } from "vitest";

import { normalizeArtistAlbums } from "../normalizeArtistAlbums";

describe("normalizeArtistAlbums", () => {
  it("filters remix rows when primary mode is on", () => {
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

  it("honors snake_case is_primary=false", () => {
    const data = {
      catalog: [
        { title: "Views", songstats_track_id: "a1" },
        { title: "One Dance (Remix)", songstats_track_id: "a2" },
      ],
    };

    const albums = normalizeArtistAlbums(data, { is_primary: "false" });

    expect(albums).toHaveLength(2);
  });

  it("drops non-object catalog entries", () => {
    const data = {
      catalog: [{ title: "Views", songstats_track_id: "a1" }, null, "bad"],
    };

    expect(normalizeArtistAlbums(data)).toHaveLength(1);
  });
});
