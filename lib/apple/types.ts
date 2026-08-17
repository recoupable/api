/** Raw Apple Music catalog shapes (camelCase, as Apple returns them). */

export type AppleCatalogAlbum = {
  id: string;
  type: "albums";
  attributes?: {
    name?: string;
    upc?: string;
    recordLabel?: string;
    copyright?: string;
    releaseDate?: string;
    trackCount?: number;
    isSingle?: boolean;
    isCompilation?: boolean;
    isComplete?: boolean;
    url?: string;
  };
};

export type AppleCatalogSong = {
  id: string;
  type: "songs";
  attributes?: {
    isrc?: string;
    name?: string;
    artistName?: string;
    composerName?: string;
    albumName?: string;
    releaseDate?: string;
    durationInMillis?: number;
    trackNumber?: number;
    discNumber?: number;
    genreNames?: string[];
    hasLyrics?: boolean;
    isAppleDigitalMaster?: boolean;
    audioVariants?: string[];
    url?: string;
    artwork?: { url?: string };
    previews?: { url?: string }[];
  };
  relationships?: {
    albums?: { data?: AppleCatalogAlbum[] };
  };
};

/**
 * Apple echoes every *requested* filter value back here, mapped to the songs it
 * matched — including an empty array for the ones it did not. This, not
 * `data[]`, is the only place a missing ISRC appears at all.
 */
export type AppleCatalogSongsResponse = {
  data?: AppleCatalogSong[];
  meta?: {
    filters?: {
      isrc?: Record<string, { id: string; type: string }[]>;
    };
  };
};

/** Our documented response shapes (snake_case). */

export type AppleSongAlbum = {
  id: string;
  name: string | null;
  upc: string | null;
  record_label: string | null;
  copyright: string | null;
  release_date: string | null;
  track_count: number | null;
  is_single: boolean;
  is_compilation: boolean;
  is_complete: boolean;
  url: string | null;
};

export type AppleSong = {
  id: string;
  isrc: string | null;
  name: string | null;
  artist_name: string | null;
  composer_name: string | null;
  album_name: string | null;
  release_date: string | null;
  duration_ms: number | null;
  track_number: number | null;
  disc_number: number | null;
  genre_names: string[];
  has_lyrics: boolean;
  is_apple_digital_master: boolean;
  audio_variants: string[];
  url: string | null;
  artwork_url: string | null;
  preview_url: string | null;
  album: AppleSongAlbum | null;
};

export type AppleIsrcResult = {
  isrc: string;
  found: boolean;
  songs: AppleSong[];
};
