/** The shapes documented for `GET /api/apple/songs` (snake_case). */
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
