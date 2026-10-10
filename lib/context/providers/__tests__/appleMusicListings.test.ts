import { expect, it } from "vitest";
import type { AppleIsrcResult, AppleSong, AppleSongAlbum } from "@/lib/apple/types";
import { storefrontListingSchema } from "../dspListingTypes";
import { mapAppleMusicListings } from "../mapAppleMusicListings";

// The ISRC is the synthetic value the other Context suites use; ids are fixture strings.
const ISRC = "USAT22103065";
const observedAt = "2026-10-10T12:00:00.000Z";
const recording = {
  isrc: ISRC,
  title: "Song",
  artists: ["Artist"],
  durationMs: 180_000,
  storefront: "us",
  observedAt,
};
const album: AppleSongAlbum = {
  id: "2001",
  name: "Album",
  upc: null,
  record_label: null,
  copyright: null,
  release_date: null,
  track_count: null,
  is_single: false,
  is_compilation: false,
  is_complete: true,
  url: "https://music.apple.com/us/album/album/2001",
};
function song(overrides: Partial<AppleSong> & { id: string }): AppleSong {
  return {
    isrc: ISRC,
    name: "Song",
    artist_name: "Artist",
    composer_name: null,
    album_name: "Album",
    release_date: null,
    duration_ms: 180_500,
    track_number: null,
    disc_number: null,
    genre_names: [],
    has_lyrics: false,
    is_apple_digital_master: false,
    audio_variants: [],
    url: `https://music.apple.com/us/album/album/2001?i=${overrides.id}`,
    artwork_url: null,
    preview_url: null,
    album,
    ...overrides,
  };
}
const found = (...songs: AppleSong[]): AppleIsrcResult => ({
  isrc: ISRC,
  found: songs.length > 0,
  songs,
});

it("maps one echoing song to an exact ISRC match with title, artist and duration evidence", () => {
  const listing = mapAppleMusicListings(recording, found(song({ id: "1001" })));
  expect(storefrontListingSchema.parse(listing)).toEqual(listing);
  expect(listing).toMatchObject({
    provider: "apple_music",
    isrc: ISRC,
    storefront: "us",
    observedAt,
    availability: { status: "listed", storefront: "us" },
    match: { status: "exact_isrc", flags: [] },
  });
  expect(listing.songListings).toHaveLength(1);
  expect(listing.songListings[0]).toMatchObject({
    provider: "apple_music",
    resourceType: "song",
    providerId: "1001",
    isrc: ISRC,
    storefront: "us",
    url: "https://music.apple.com/us/album/album/2001?i=1001",
    availability: { status: "listed", storefront: "us" },
    match: {
      status: "exact_isrc",
      evidence: {
        isrcEcho: true,
        titleMatch: true,
        artistMatch: true,
        durationDeltaMs: 500,
        versionTokens: [],
      },
      flags: [],
    },
    albumListing: {
      provider: "apple_music",
      resourceType: "album",
      providerId: "2001",
      storefront: "us",
      upc: null,
      isSingle: false,
      isCompilation: false,
    },
  });
});

it("keeps every album context for one ISRC in one storefront without calling it a regional variant", () => {
  const listing = mapAppleMusicListings(
    recording,
    found(
      song({ id: "1001" }),
      song({ id: "1002", album: { ...album, id: "2002", name: "Album", is_single: true } }),
    ),
  );
  expect(listing.availability.status).toBe("listed");
  expect(listing.match).toEqual({
    status: "ambiguous",
    flags: ["multiple_store_songs", "multiple_album_contexts"],
  });
  expect(listing.songListings.map(s => s.providerId)).toEqual(["1001", "1002"]);
  expect(listing.songListings.map(s => s.albumListing?.providerId)).toEqual(["2001", "2002"]);
  expect(listing.songListings.map(s => s.albumListing?.isSingle)).toEqual([false, true]);
  for (const item of listing.songListings) {
    expect(item.match.status).toBe("ambiguous");
    expect(item.match.evidence.isrcEcho).toBe(true);
    expect(item.match.flags).toEqual(["multiple_store_songs", "multiple_album_contexts"]);
  }
});

it("flags two store songs on the same album without claiming several album contexts", () => {
  const listing = mapAppleMusicListings(
    recording,
    found(song({ id: "1001" }), song({ id: "1005", track_number: 12 })),
  );
  expect(listing.match).toEqual({ status: "ambiguous", flags: ["multiple_store_songs"] });
});

it("flags a remix or alternate title, retains the version token and stays ambiguous", () => {
  const listing = mapAppleMusicListings(
    recording,
    found(song({ id: "1003", name: "Song (Club Remix)" })),
  );
  expect(listing.match.status).toBe("ambiguous");
  expect(listing.songListings[0].match).toMatchObject({
    status: "ambiguous",
    flags: ["remix_or_alternate_title"],
    evidence: { isrcEcho: true, titleMatch: true, versionTokens: ["remix"] },
  });
  const remixRecording = mapAppleMusicListings(
    { ...recording, title: "Song (Club Remix)" },
    found(song({ id: "1003", name: "Song (Club Remix)" })),
  );
  expect(remixRecording.songListings[0].match).toMatchObject({
    status: "exact_isrc",
    flags: [],
    evidence: { versionTokens: [] },
  });
});

it("compares titles and artists by whole words, not substrings", () => {
  const listing = mapAppleMusicListings(
    recording,
    found(song({ id: "1007", name: "Songbird", artist_name: "Artistry" })),
  );
  expect(listing.songListings[0].match).toMatchObject({
    status: "ambiguous",
    evidence: { isrcEcho: true, titleMatch: false, artistMatch: false },
  });
  const featured = mapAppleMusicListings(
    { ...recording, artists: ["Artist", "Guest"] },
    found(song({ id: "1008", name: "Song (feat. Guest)", artist_name: "Artist & Guest" })),
  );
  expect(featured.songListings[0].match).toMatchObject({
    status: "exact_isrc",
    evidence: { titleMatch: true, artistMatch: true, versionTokens: [] },
  });
});

it("reports a missing ISRC as not listed in that storefront only", () => {
  const listing = mapAppleMusicListings(
    { ...recording, storefront: "jp" },
    { isrc: ISRC, found: false, songs: [] },
  );
  expect(storefrontListingSchema.parse(listing)).toEqual(listing);
  expect(listing).toMatchObject({
    storefront: "jp",
    availability: { status: "not_listed", storefront: "jp" },
    match: { status: "not_found", flags: [] },
    songListings: [],
  });
  expect(Object.keys(listing.availability).sort()).toEqual(["status", "storefront"]);
});

it("keeps an echoed but unresolved hit as unknown availability, never as not listed", () => {
  const listing = mapAppleMusicListings(recording, { isrc: ISRC, found: true, songs: [] });
  expect(listing.availability).toEqual({ status: "unknown", storefront: "us" });
  expect(listing.match.status).toBe("ambiguous");
  expect(listing.songListings).toEqual([]);
});

it("never writes the album id into a recording or song identifier field", () => {
  const listing = mapAppleMusicListings(recording, found(song({ id: "1001" })));
  const { albumListing, ...songOnly } = listing.songListings[0];
  expect(albumListing).toMatchObject({ resourceType: "album", providerId: "2001" });
  expect(songOnly).toMatchObject({ resourceType: "song", providerId: "1001", isrc: ISRC });
  expect("providerId" in listing).toBe(false);
  expect([listing.isrc, songOnly.providerId, songOnly.isrc]).not.toContain("2001");
});

it("rejects an unknown storefront and lowercases a known one before reading provider data", () => {
  expect(() => mapAppleMusicListings({ ...recording, storefront: "zz" }, found())).toThrow(
    /storefront/i,
  );
  expect(() => mapAppleMusicListings({ ...recording, storefront: "usa" }, found())).toThrow(
    /storefront/i,
  );
  expect(mapAppleMusicListings({ ...recording, storefront: "GB" }, found()).storefront).toBe("gb");
});

it("keeps a song whose own ISRC differs from the requested one as ambiguous evidence", () => {
  const listing = mapAppleMusicListings(
    recording,
    found(song({ id: "1004", isrc: "USAT22199999" })),
  );
  expect(listing.isrc).toBe(ISRC);
  expect(listing.match.status).toBe("ambiguous");
  expect(listing.songListings[0]).toMatchObject({
    providerId: "1004",
    isrc: "USAT22199999",
    match: { status: "ambiguous", evidence: { isrcEcho: false } },
  });
});

it("refuses a provider result that answers a different ISRC", () => {
  expect(() =>
    mapAppleMusicListings(recording, { isrc: "USAT22199999", found: false, songs: [] }),
  ).toThrow(/ISRC/);
});

it("keeps unknown title, artist, duration and album evidence null", () => {
  const { isrc, title, artists, storefront } = recording;
  const listing = mapAppleMusicListings(
    { isrc, title, artists, storefront, observedAt },
    found(
      song({
        id: "1006",
        name: null,
        artist_name: null,
        duration_ms: null,
        album: null,
        url: null,
      }),
    ),
  );
  expect(storefrontListingSchema.parse(listing)).toEqual(listing);
  expect(listing.songListings[0]).toMatchObject({
    url: null,
    albumListing: null,
    match: {
      status: "exact_isrc",
      evidence: {
        isrcEcho: true,
        titleMatch: null,
        artistMatch: null,
        durationDeltaMs: null,
        versionTokens: [],
      },
    },
  });
});
