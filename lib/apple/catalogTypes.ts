/**
 * Raw Apple Music catalog shapes, camelCase exactly as Apple returns them.
 * Our own contract shapes live in `types.ts`.
 */

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
