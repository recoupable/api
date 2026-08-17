import type { AppleCatalogAlbum, AppleCatalogSong } from "./catalogTypes";
import type { AppleSong, AppleSongAlbum } from "./types";

function mapAlbum(album: AppleCatalogAlbum | undefined): AppleSongAlbum | null {
  if (!album) return null;

  const attributes = album.attributes ?? {};

  return {
    id: album.id,
    name: attributes.name ?? null,
    upc: attributes.upc ?? null,
    record_label: attributes.recordLabel ?? null,
    copyright: attributes.copyright ?? null,
    release_date: attributes.releaseDate ?? null,
    track_count: attributes.trackCount ?? null,
    is_single: attributes.isSingle ?? false,
    is_compilation: attributes.isCompilation ?? false,
    is_complete: attributes.isComplete ?? false,
    url: attributes.url ?? null,
  };
}

/**
 * Maps a raw Apple Music catalog song onto the documented `AppleSong` contract,
 * folding in the release from the `albums` relationship so `upc`,
 * `record_label`, and `copyright` arrive without a second round trip.
 *
 * @param song - A song object from an Apple Music catalog response.
 * @returns The snake_case shape documented for `GET /api/apple/songs`.
 */
export function mapAppleSong(song: AppleCatalogSong): AppleSong {
  const attributes = song.attributes ?? {};

  return {
    id: song.id,
    isrc: attributes.isrc ?? null,
    name: attributes.name ?? null,
    artist_name: attributes.artistName ?? null,
    composer_name: attributes.composerName ?? null,
    album_name: attributes.albumName ?? null,
    release_date: attributes.releaseDate ?? null,
    duration_ms: attributes.durationInMillis ?? null,
    track_number: attributes.trackNumber ?? null,
    disc_number: attributes.discNumber ?? null,
    genre_names: attributes.genreNames ?? [],
    has_lyrics: attributes.hasLyrics ?? false,
    is_apple_digital_master: attributes.isAppleDigitalMaster ?? false,
    audio_variants: attributes.audioVariants ?? [],
    url: attributes.url ?? null,
    artwork_url: attributes.artwork?.url ?? null,
    preview_url: attributes.previews?.[0]?.url ?? null,
    album: mapAlbum(song.relationships?.albums?.data?.[0]),
  };
}
