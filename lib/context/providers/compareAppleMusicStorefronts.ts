import {
  recordingListingSchema,
  type DspMatchFlag,
  type RecordingListing,
  type StorefrontListing,
} from "./dspListingTypes";

const withFlag = (flags: DspMatchFlag[], flag: DspMatchFlag): DspMatchFlag[] =>
  flags.includes(flag) ? flags : [...flags, flag];

/**
 * Combines one recording's per-storefront Apple Music observations into one saved result.
 *
 * Only storefronts that resolved songs are compared. When the store song ids or
 * album ids differ between them, every song listing whose song or album is absent
 * from another listed storefront gains `regional_variant`; its match status is not
 * changed. With fewer than two listed storefronts no comparison is possible, so
 * `varies` stays null. A not-listed storefront is kept as availability evidence and
 * never counts as a variant. Song and album ids are reported separately.
 *
 * @param meta - The requested recording ISRC and the server's collection version.
 * @param listings - One `mapAppleMusicListings` observation per distinct storefront.
 * @returns The recording-level listing observation, storefronts sorted by code.
 */
export function compareAppleMusicStorefronts(
  meta: { isrc: string; collectionVersion: string },
  listings: StorefrontListing[],
): RecordingListing {
  const storefronts = [...listings].sort((a, b) => a.storefront.localeCompare(b.storefront));
  if (new Set(storefronts.map(listing => listing.storefront)).size !== storefronts.length)
    throw new Error("Each Apple Music storefront may be observed once per result");
  if (storefronts.some(listing => listing.isrc !== meta.isrc))
    throw new Error("Storefront listing does not match the requested ISRC");
  const listed = storefronts.filter(listing => listing.songListings.length > 0);
  const songIds = listed.map(listing => new Set(listing.songListings.map(song => song.providerId)));
  const albumIds = listed.map(
    listing =>
      new Set(
        listing.songListings.flatMap(song =>
          song.albumListing ? [song.albumListing.providerId] : [],
        ),
      ),
  );
  const inEvery = (sets: Set<string>[], id: string) => sets.every(set => set.has(id));
  const allSongIds = [...new Set(songIds.flatMap(set => [...set]))].sort();
  const allAlbumIds = [...new Set(albumIds.flatMap(set => [...set]))].sort();
  const varies =
    listed.length < 2
      ? null
      : allSongIds.some(id => !inEvery(songIds, id)) ||
        allAlbumIds.some(id => !inEvery(albumIds, id));
  const compared = storefronts.map(listing => {
    if (!varies) return listing;
    const songListings = listing.songListings.map(song => {
      const regional =
        !inEvery(songIds, song.providerId) ||
        (song.albumListing != null && !inEvery(albumIds, song.albumListing.providerId));
      return regional
        ? {
            ...song,
            match: { ...song.match, flags: withFlag(song.match.flags, "regional_variant") },
          }
        : song;
    });
    const flags = [...new Set(songListings.flatMap(song => song.match.flags))];
    return { ...listing, songListings, match: { ...listing.match, flags } };
  });
  return recordingListingSchema.parse({
    provider: "apple_music",
    isrc: meta.isrc,
    collectionVersion: meta.collectionVersion,
    storefronts: compared,
    regionalComparison: {
      listedStorefronts: listed.map(listing => listing.storefront),
      songProviderIds: allSongIds,
      albumProviderIds: allAlbumIds,
      varies,
    },
    identityConfirmed: false,
  });
}
