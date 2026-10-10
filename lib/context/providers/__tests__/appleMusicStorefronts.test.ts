import { expect, it } from "vitest";
import type { AppleIsrcResult, AppleSong } from "@/lib/apple/types";
import { compareAppleMusicStorefronts } from "../compareAppleMusicStorefronts";
import { recordingListingSchema } from "../dspListingTypes";
import { mapAppleMusicListings } from "../mapAppleMusicListings";

// Synthetic ISRC shared with the other Context suites; store ids are fixture strings.
const ISRC = "USAT22103065";
const observedAt = "2026-10-10T12:00:00.000Z";
function song(id: string, albumId: string, storefront: string): AppleSong {
  return {
    id,
    isrc: ISRC,
    name: "Song",
    artist_name: "Artist",
    composer_name: null,
    album_name: "Album",
    release_date: null,
    duration_ms: 180_000,
    track_number: null,
    disc_number: null,
    genre_names: [],
    has_lyrics: false,
    is_apple_digital_master: false,
    audio_variants: [],
    url: `https://music.apple.com/${storefront}/album/album/${albumId}?i=${id}`,
    artwork_url: null,
    preview_url: null,
    album: {
      id: albumId,
      name: "Album",
      upc: null,
      record_label: null,
      copyright: null,
      release_date: null,
      track_count: null,
      is_single: false,
      is_compilation: false,
      is_complete: true,
      url: `https://music.apple.com/${storefront}/album/album/${albumId}`,
    },
  };
}
function observe(storefront: string, ...songs: AppleSong[]) {
  const result: AppleIsrcResult = { isrc: ISRC, found: songs.length > 0, songs };
  return mapAppleMusicListings(
    { isrc: ISRC, title: "Song", artists: ["Artist"], storefront, observedAt },
    result,
  );
}
const meta = { isrc: ISRC, collectionVersion: "fixture-v1" };

it("keeps identical listings in two storefronts as one comparable observation without variants", () => {
  const listing = compareAppleMusicStorefronts(meta, [
    observe("us", song("1001", "2001", "us")),
    observe("gb", song("1001", "2001", "gb")),
  ]);
  expect(recordingListingSchema.parse(listing)).toEqual(listing);
  expect(listing).toMatchObject({
    provider: "apple_music",
    isrc: ISRC,
    collectionVersion: "fixture-v1",
    identityConfirmed: false,
    regionalComparison: {
      listedStorefronts: ["gb", "us"],
      songProviderIds: ["1001"],
      albumProviderIds: ["2001"],
      varies: false,
    },
  });
  expect(listing.storefronts.map(s => s.storefront)).toEqual(["gb", "us"]);
  for (const storefront of listing.storefronts) {
    expect(storefront.match).toEqual({ status: "exact_isrc", flags: [] });
    expect(storefront.songListings[0].match.flags).toEqual([]);
  }
});

it("flags a regional variant when one storefront carries the ISRC on a different album", () => {
  const listing = compareAppleMusicStorefronts(meta, [
    observe("us", song("1001", "2001", "us")),
    observe("jp", song("1001", "2009", "jp")),
  ]);
  expect(listing.regionalComparison).toEqual({
    listedStorefronts: ["jp", "us"],
    songProviderIds: ["1001"],
    albumProviderIds: ["2001", "2009"],
    varies: true,
  });
  for (const storefront of listing.storefronts) {
    // Each storefront is still an exact ISRC echo there; the variant is a flag, not a promotion.
    expect(storefront.match).toEqual({ status: "exact_isrc", flags: ["regional_variant"] });
    expect(storefront.songListings[0].match.flags).toEqual(["regional_variant"]);
    expect(storefront.songListings[0].albumListing?.storefront).toBe(storefront.storefront);
  }
  expect(
    listing.storefronts.find(s => s.storefront === "jp")?.songListings[0].albumListing,
  ).toMatchObject({ resourceType: "album", providerId: "2009" });
});

it("flags only the store song that is missing from another listed storefront", () => {
  const listing = compareAppleMusicStorefronts(meta, [
    observe("us", song("1001", "2001", "us")),
    observe("gb", song("1001", "2001", "gb"), song("1010", "2010", "gb")),
  ]);
  expect(listing.regionalComparison.varies).toBe(true);
  const gb = listing.storefronts.find(s => s.storefront === "gb");
  expect(gb?.songListings.map(s => [s.providerId, s.match.flags])).toEqual([
    ["1001", ["multiple_store_songs", "multiple_album_contexts"]],
    ["1010", ["multiple_store_songs", "multiple_album_contexts", "regional_variant"]],
  ]);
  expect(gb?.match).toEqual({
    status: "ambiguous",
    flags: ["multiple_store_songs", "multiple_album_contexts", "regional_variant"],
  });
  const us = listing.storefronts.find(s => s.storefront === "us");
  expect(us?.match).toEqual({ status: "exact_isrc", flags: [] });
});

it("retains a not-listed storefront as availability evidence and cannot compare one listing", () => {
  const listing = compareAppleMusicStorefronts(meta, [
    observe("us", song("1001", "2001", "us")),
    observe("jp"),
  ]);
  expect(listing.regionalComparison).toEqual({
    listedStorefronts: ["us"],
    songProviderIds: ["1001"],
    albumProviderIds: ["2001"],
    varies: null,
  });
  expect(listing.storefronts.map(s => [s.storefront, s.availability.status])).toEqual([
    ["jp", "not_listed"],
    ["us", "listed"],
  ]);
  expect(listing.storefronts.flatMap(s => s.match.flags)).toEqual([]);
});

it("never lists an album id as a song id in the comparison", () => {
  const listing = compareAppleMusicStorefronts(meta, [
    observe("us", song("1001", "2001", "us")),
    observe("jp", song("1002", "2002", "jp")),
  ]);
  expect(listing.regionalComparison.songProviderIds).toEqual(["1001", "1002"]);
  expect(listing.regionalComparison.albumProviderIds).toEqual(["2001", "2002"]);
});

it("rejects a repeated storefront or a listing for another ISRC", () => {
  expect(() =>
    compareAppleMusicStorefronts(meta, [
      observe("us", song("1001", "2001", "us")),
      observe("us", song("1001", "2001", "us")),
    ]),
  ).toThrow(/storefront/i);
  expect(() =>
    compareAppleMusicStorefronts({ ...meta, isrc: "USAT22199999" }, [observe("us")]),
  ).toThrow(/ISRC/);
  expect(() => compareAppleMusicStorefronts(meta, [])).toThrow();
});
