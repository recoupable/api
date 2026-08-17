import { generateDeveloperToken } from "./generateDeveloperToken";
import { mapAppleSong } from "./mapAppleSong";
import type { AppleCatalogSong, AppleCatalogSongsResponse, AppleIsrcResult } from "./types";

const APPLE_MUSIC_API = "https://api.music.apple.com";

/** Apple hard-caps `filter[isrc]`; a 26th value is a 400, not a truncation. */
export const MAX_ISRCS_PER_REQUEST = 25;

type GetAppleSongsByIsrcParams = {
  isrcs: string[];
  storefront: string;
};

type GetAppleSongsByIsrcResult = {
  results: AppleIsrcResult[] | null;
  error: Error | null;
};

function buildUrl(isrcs: string[], storefront: string): string {
  const params = new URLSearchParams({
    "filter[isrc]": isrcs.join(","),
    include: "albums",
    extend: "composerName,audioVariants",
    limit: "100",
  });
  return `${APPLE_MUSIC_API}/v1/catalog/${storefront}/songs?${params}`;
}

async function fetchChunk(
  isrcs: string[],
  storefront: string,
  token: string,
): Promise<Map<string, AppleCatalogSong[]>> {
  const response = await fetch(buildUrl(isrcs, storefront), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Apple Music API responded ${response.status}: ${await response.text()}`);
  }

  const body = (await response.json()) as AppleCatalogSongsResponse;
  const songsById = new Map((body.data ?? []).map(song => [song.id, song]));

  // Read from `meta.filters`, never from `data[].attributes.isrc` — the meta map
  // is the only place a requested-but-unmatched ISRC appears, and matching on
  // the attribute silently drops any song whose ISRC differs from the request.
  return new Map(
    Object.entries(body.meta?.filters?.isrc ?? {}).map(([isrc, hits]) => [
      isrc,
      hits.map(hit => songsById.get(hit.id)).filter((song): song is AppleCatalogSong => !!song),
    ]),
  );
}

/**
 * Looks up recordings in the Apple Music catalog by ISRC, chunked to Apple's
 * 25-value filter cap.
 *
 * Returns one entry per *requested* ISRC in the order requested, so an ISRC
 * Apple does not carry comes back as `found: false` rather than disappearing.
 *
 * @param params.isrcs - ISRCs to look up, already validated and uppercased.
 * @param params.storefront - Two-letter Apple Music storefront code.
 * @returns The per-ISRC results, or an error if Apple could not be reached.
 */
export async function getAppleSongsByIsrc({
  isrcs,
  storefront,
}: GetAppleSongsByIsrcParams): Promise<GetAppleSongsByIsrcResult> {
  try {
    const token = generateDeveloperToken();
    const chunks: string[][] = [];
    for (let i = 0; i < isrcs.length; i += MAX_ISRCS_PER_REQUEST) {
      chunks.push(isrcs.slice(i, i + MAX_ISRCS_PER_REQUEST));
    }

    const matched = new Map<string, AppleCatalogSong[]>();
    for (const chunk of await Promise.all(
      chunks.map(chunk => fetchChunk(chunk, storefront, token)),
    )) {
      for (const [isrc, songs] of chunk) matched.set(isrc, songs);
    }

    const results = isrcs.map(isrc => {
      const songs = matched.get(isrc) ?? [];
      return { isrc, found: songs.length > 0, songs: songs.map(mapAppleSong) };
    });

    return { results, error: null };
  } catch (unknownError) {
    return {
      results: null,
      error:
        unknownError instanceof Error
          ? unknownError
          : new Error("Unknown error fetching Apple Music songs by ISRC"),
    };
  }
}
