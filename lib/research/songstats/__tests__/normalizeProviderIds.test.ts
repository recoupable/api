import { describe, expect, it } from "vitest";

import { normalizeArtistRecord } from "@/lib/research/songstats/normalizeArtistRecord";
import { normalizeEntityRecord } from "@/lib/research/songstats/normalizeEntityRecord";
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

describe("normalizeEntityRecord", () => {
  it("normalizes track-shaped catalog rows", () => {
    expect(
      normalizeEntityRecord({ songstats_track_id: "t1", title: "Song" }),
    ).toEqual({ id: "t1", title: "Song" });
  });

  it("normalizes artist-shaped catalog rows", () => {
    expect(
      normalizeEntityRecord({ songstats_artist_id: "a1", name: "Drake" }),
    ).toEqual({ id: "a1", name: "Drake" });
  });
});
