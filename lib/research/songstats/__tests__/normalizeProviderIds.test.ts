import { describe, expect, it } from "vitest";

import { normalizeAlbumRecord } from "@/lib/research/songstats/normalizeAlbumRecord";
import { normalizeAlbumsCatalogItem } from "@/lib/research/songstats/normalizeAlbumsCatalogItem";
import { normalizeArtistRecord } from "@/lib/research/songstats/normalizeArtistRecord";
import { normalizeTrackLookupObject } from "@/lib/research/songstats/normalizeTrackLookupObject";
import { normalizeTrackRecord } from "@/lib/research/songstats/normalizeTrackRecord";

describe("normalizeArtistRecord", () => {
  it("exposes provider-neutral id and omits SongStats alias fields", () => {
    expect(
      normalizeArtistRecord({
        songstats_artist_id: "wjcgfd9i",
        artist_id: "legacy",
        name: "Drake",
      }),
    ).toEqual({ id: "wjcgfd9i", name: "Drake" });
  });
});

describe("normalizeTrackRecord", () => {
  it("exposes provider-neutral id and omits SongStats alias fields", () => {
    expect(
      normalizeTrackRecord({
        songstats_track_id: "track_1",
        track_id: "legacy",
        title: "Hotline Bling",
      }),
    ).toEqual({ id: "track_1", title: "Hotline Bling" });
  });

  it("normalizes id-only track rows without misclassifying as artist", () => {
    expect(normalizeTrackRecord({ id: "t1", title: "Song" })).toEqual({
      id: "t1",
      title: "Song",
    });
  });
});

describe("normalizeAlbumRecord", () => {
  it("exposes provider-neutral id and omits SongStats album alias fields", () => {
    expect(
      normalizeAlbumRecord({
        songstats_album_id: "album_1",
        album_id: "legacy",
        name: "Scorpion",
      }),
    ).toEqual({ id: "album_1", name: "Scorpion" });
  });
});

describe("normalizeAlbumsCatalogItem", () => {
  it("normalizes album rows on the albums catalog path", () => {
    expect(normalizeAlbumsCatalogItem({ songstats_album_id: "album_1", name: "Views" })).toEqual({
      id: "album_1",
      name: "Views",
    });
  });

  it("normalizes track-shaped rows without using artist id dispatch", () => {
    expect(normalizeAlbumsCatalogItem({ songstats_track_id: "t1", title: "Song" })).toEqual({
      id: "t1",
      title: "Song",
    });
  });
});

describe("normalizeTrackLookupObject", () => {
  it("returns only provider-neutral id for get-ids payloads", () => {
    expect(
      normalizeTrackLookupObject({
        songstats_track_id: "track_7",
        songstats_track_ids: ["track_7"],
      }),
    ).toEqual({ id: "track_7" });
  });
});
