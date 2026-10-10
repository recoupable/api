import { z } from "zod";
import type { AppleIsrcResult, AppleSong } from "@/lib/apple/types";
import {
  appleStorefrontSchema,
  storefrontListingSchema,
  type DspAlbumListing,
  type DspMatchEvidence,
  type DspMatchFlag,
  type DspSongListing,
  type StorefrontListing,
} from "./dspListingTypes";

const inputSchema = z.strictObject({
  isrc: z.string().regex(/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/),
  title: z.string().min(1).max(300),
  artists: z.array(z.string().min(1).max(200)).min(1).max(20),
  durationMs: z.number().int().positive().max(7_200_000).optional(),
  storefront: appleStorefrontSchema,
  observedAt: z.iso.datetime(),
});
export type AppleMusicListingInput = z.input<typeof inputSchema>;
type Input = z.output<typeof inputSchema>;

/** Whole-word title tokens that usually name another recording of the same work (same idea as the YouTube screen). */
const VERSION_TOKENS = [
  "remix",
  "mix",
  "edit",
  "extended",
  "live",
  "sped up",
  "slowed",
  "acoustic",
  "instrumental",
  "karaoke",
  "cover",
  "demo",
  "reprise",
  "remaster",
  "remastered",
];
const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
const stripFeatured = (value: string) =>
  value.replace(/\s*[([](?:feat\.?|ft\.?|featuring)\b[^)\]]*[)\]]/gi, "");
/** Whole-word containment, so "Song" does not match "Songbird". */
const containsWords = (text: string, words: string) =>
  words.length > 0 && ` ${text} `.includes(` ${words} `);

function compare(input: Input, song: AppleSong): DspMatchEvidence {
  const title = normalize(stripFeatured(input.title));
  const name = song.name == null ? null : normalize(song.name);
  const artistText = song.artist_name == null ? null : normalize(song.artist_name);
  return {
    isrcEcho: song.isrc?.toUpperCase() === input.isrc,
    titleMatch: name == null ? null : containsWords(name, title),
    artistMatch:
      artistText == null
        ? null
        : input.artists.every(artist => containsWords(artistText, normalize(artist))),
    durationDeltaMs:
      song.duration_ms == null || input.durationMs == null
        ? null
        : song.duration_ms - input.durationMs,
    versionTokens:
      name == null
        ? []
        : VERSION_TOKENS.filter(
            token => containsWords(name, token) && !containsWords(normalize(input.title), token),
          ),
  };
}

function albumListing(song: AppleSong, storefront: string): DspAlbumListing | null {
  if (!song.album) return null;
  return {
    provider: "apple_music",
    resourceType: "album",
    providerId: song.album.id,
    storefront,
    name: song.album.name,
    upc: song.album.upc,
    isSingle: song.album.is_single,
    isCompilation: song.album.is_compilation,
    url: song.album.url,
  };
}

/** Flags every listing shares when one ISRC resolves to several store songs in this storefront. */
function sharedFlags(songs: AppleSong[]): DspMatchFlag[] {
  if (songs.length < 2) return [];
  const albums = new Set(songs.map(song => song.album?.id).filter(id => id != null));
  return albums.size > 1
    ? ["multiple_store_songs", "multiple_album_contexts"]
    : ["multiple_store_songs"];
}

/**
 * Maps one Apple Music ISRC lookup for one storefront onto the DSP listing contract.
 *
 * Rules: `exact_isrc` needs a single song that echoes the ISRC without a title or
 * artist contradiction or an extra version token; anything else is `ambiguous`
 * and is kept, never dropped or promoted. `found: false` is `not_listed` for this
 * storefront only. A hit Apple echoes but does not resolve is `unknown`, not a
 * takedown. The album stays a separate listing; its id never becomes a song,
 * recording or release identifier. Nothing here confirms identity or rights.
 * Regional variants need more than one storefront; see `compareAppleMusicStorefronts`.
 *
 * @param input - The recording being looked up and the storefront observed.
 * @param result - The per-ISRC Apple result for that storefront (fixture or live).
 * @returns The storefront-scoped listing observation.
 */
export function mapAppleMusicListings(
  input: AppleMusicListingInput,
  result: AppleIsrcResult,
): StorefrontListing {
  const args = inputSchema.parse(input);
  if (result.isrc.toUpperCase() !== args.isrc)
    throw new Error("Apple Music result does not match the requested ISRC");
  const common = sharedFlags(result.songs);
  const songListings: DspSongListing[] = result.songs.map(song => {
    const evidence = compare(args, song);
    const flags: DspMatchFlag[] =
      evidence.versionTokens.length > 0 ? [...common, "remix_or_alternate_title"] : common;
    const exact =
      result.songs.length === 1 &&
      evidence.isrcEcho &&
      evidence.titleMatch !== false &&
      evidence.artistMatch !== false &&
      evidence.versionTokens.length === 0;
    return {
      provider: "apple_music",
      resourceType: "song",
      providerId: song.id,
      isrc: song.isrc,
      name: song.name,
      artistName: song.artist_name,
      durationMs: song.duration_ms,
      storefront: args.storefront,
      url: song.url,
      observedAt: args.observedAt,
      availability: { status: "listed", storefront: args.storefront },
      match: { status: exact ? "exact_isrc" : "ambiguous", evidence, flags },
      albumListing: albumListing(song, args.storefront),
    };
  });
  return storefrontListingSchema.parse({
    provider: "apple_music",
    isrc: args.isrc,
    storefront: args.storefront,
    observedAt: args.observedAt,
    availability: {
      status: !result.found ? "not_listed" : songListings.length === 0 ? "unknown" : "listed",
      storefront: args.storefront,
    },
    match: {
      status: !result.found
        ? "not_found"
        : songListings.length === 1 && songListings[0].match.status === "exact_isrc"
          ? "exact_isrc"
          : "ambiguous",
      flags: [...new Set(songListings.flatMap(listing => listing.match.flags))],
    },
    songListings,
  });
}
