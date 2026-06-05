import { describe, expect, it } from "vitest";

import { buildArtistCatalogQuery } from "../buildArtistCatalogQuery";

describe("buildArtistCatalogQuery", () => {
  it("defaults is_primary to true when query is omitted", () => {
    expect(buildArtistCatalogQuery("artist_1")).toEqual({
      songstats_artist_id: "artist_1",
      is_primary: "true",
      isPrimary: "true",
    });
  });

  it("honors snake_case is_primary=false", () => {
    expect(buildArtistCatalogQuery("artist_1", { is_primary: "false" })).toMatchObject({
      is_primary: "false",
      isPrimary: "false",
    });
  });

  it("treats empty is_primary as default true", () => {
    expect(buildArtistCatalogQuery("artist_1", { is_primary: "" })).toMatchObject({
      is_primary: "true",
      isPrimary: "true",
    });
  });

  it("does not allow query params to override the route artist id", () => {
    const params = buildArtistCatalogQuery("artist_1", {
      songstats_artist_id: "other_artist",
      limit: "5",
    });

    expect(params.songstats_artist_id).toBe("artist_1");
    expect(params.limit).toBe("5");
  });
});
