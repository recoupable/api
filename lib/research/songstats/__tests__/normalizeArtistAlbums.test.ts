import { describe, expect, it } from "vitest";

import { normalizeArtistAlbums } from "../normalizeArtistAlbums";

describe("normalizeArtistAlbums", () => {
  it("returns catalog rows without client-side primary filtering", () => {
    const data = {
      catalog: [
        { title: "Views", songstats_track_id: "a1" },
        { title: "One Dance (Remix)", songstats_track_id: "a2" },
      ],
    };

    const albums = normalizeArtistAlbums(data, { isPrimary: "true" });

    expect(albums).toHaveLength(2);
    expect(albums[0]).toMatchObject({ title: "Views", id: "a1" });
  });

  it("does not re-slice when limit is present (paging stays on SongStats)", () => {
    const data = {
      catalog: [
        { title: "A", songstats_track_id: "a1" },
        { title: "B", songstats_track_id: "a2" },
        { title: "C", songstats_track_id: "a3" },
      ],
    };

    const albums = normalizeArtistAlbums(data, { isPrimary: "true", limit: "2" });

    expect(albums).toHaveLength(3);
  });
});
