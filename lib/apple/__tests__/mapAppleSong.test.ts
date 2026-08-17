import { describe, it, expect } from "vitest";
import { mapAppleSong } from "../mapAppleSong";
import type { AppleCatalogSong } from "../types";

/** Trimmed from a live `filter[isrc]` response captured 2026-08-17. */
const liveSong = {
  id: "1894880802",
  type: "songs",
  attributes: {
    albumName: "Box Fan All Night",
    artistName: "Sleep Sounds & Sleepy Buddy",
    artwork: { url: "https://is1-ssl.mzstatic.com/image/thumb/x.png/{w}x{h}bb.jpg" },
    audioVariants: ["lossless", "lossy-stereo"],
    composerName: "Zachary Kubilus",
    discNumber: 1,
    durationInMillis: 124001,
    genreNames: ["New Age", "Music", "Worldwide"],
    hasLyrics: false,
    isAppleDigitalMaster: false,
    isrc: "DEH742611917",
    name: "Steady Box Fan White Noise (Extended Mix)",
    previews: [{ url: "https://audio-ssl.itunes.apple.com/preview.m4a" }],
    releaseDate: "2026-05-01",
    trackNumber: 6,
    url: "https://music.apple.com/us/album/x/1894880796?i=1894880802",
  },
  relationships: {
    albums: {
      data: [
        {
          id: "1894880796",
          type: "albums",
          attributes: {
            copyright: "℗ 2026 Sleep Sounds",
            isCompilation: false,
            isComplete: true,
            isSingle: false,
            name: "Box Fan All Night",
            recordLabel: "Sleep Sounds",
            releaseDate: "2026-05-01",
            trackCount: 20,
            upc: "4065328882161",
            url: "https://music.apple.com/us/album/box-fan-all-night/1894880796",
          },
        },
      ],
    },
  },
} as unknown as AppleCatalogSong;

describe("mapAppleSong", () => {
  it("maps Apple's camelCase attributes onto the documented snake_case contract", () => {
    expect(mapAppleSong(liveSong)).toEqual({
      id: "1894880802",
      isrc: "DEH742611917",
      name: "Steady Box Fan White Noise (Extended Mix)",
      artist_name: "Sleep Sounds & Sleepy Buddy",
      composer_name: "Zachary Kubilus",
      album_name: "Box Fan All Night",
      release_date: "2026-05-01",
      duration_ms: 124001,
      track_number: 6,
      disc_number: 1,
      genre_names: ["New Age", "Music", "Worldwide"],
      has_lyrics: false,
      is_apple_digital_master: false,
      audio_variants: ["lossless", "lossy-stereo"],
      url: "https://music.apple.com/us/album/x/1894880796?i=1894880802",
      artwork_url: "https://is1-ssl.mzstatic.com/image/thumb/x.png/{w}x{h}bb.jpg",
      preview_url: "https://audio-ssl.itunes.apple.com/preview.m4a",
      album: {
        id: "1894880796",
        name: "Box Fan All Night",
        upc: "4065328882161",
        record_label: "Sleep Sounds",
        copyright: "℗ 2026 Sleep Sounds",
        release_date: "2026-05-01",
        track_count: 20,
        is_single: false,
        is_compilation: false,
        is_complete: true,
        url: "https://music.apple.com/us/album/box-fan-all-night/1894880796",
      },
    });
  });

  it("returns a null album rather than throwing when the release is not included", () => {
    const withoutAlbum = { ...liveSong, relationships: undefined } as AppleCatalogSong;

    expect(mapAppleSong(withoutAlbum).album).toBeNull();
  });

  it("nulls the optional media urls when Apple omits artwork and previews", () => {
    const bare = {
      ...liveSong,
      attributes: { ...liveSong.attributes, artwork: undefined, previews: [] },
    } as unknown as AppleCatalogSong;

    const mapped = mapAppleSong(bare);

    expect(mapped.artwork_url).toBeNull();
    expect(mapped.preview_url).toBeNull();
  });

  it("defaults the array fields so callers never destructure undefined", () => {
    const bare = {
      id: "1",
      type: "songs",
      attributes: { isrc: "X", name: "n", artistName: "a", albumName: "b" },
    } as unknown as AppleCatalogSong;

    const mapped = mapAppleSong(bare);

    expect(mapped.genre_names).toEqual([]);
    expect(mapped.audio_variants).toEqual([]);
    expect(mapped.composer_name).toBeNull();
  });
});
