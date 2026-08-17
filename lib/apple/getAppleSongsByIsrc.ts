import { generateDeveloperToken } from "./generateDeveloperToken";
import { fetchAppleSongsChunk, type AppleChunkHits } from "./fetchAppleSongsChunk";
import { mapAppleSong } from "./mapAppleSong";
import type { AppleIsrcResult } from "./types";

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

function chunk(isrcs: string[]): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < isrcs.length; i += MAX_ISRCS_PER_REQUEST) {
    chunks.push(isrcs.slice(i, i + MAX_ISRCS_PER_REQUEST));
  }
  return chunks;
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

    const matched: AppleChunkHits = new Map();
    for (const hits of await Promise.all(
      chunk(isrcs).map(batch => fetchAppleSongsChunk(batch, storefront, token)),
    )) {
      for (const [isrc, hit] of hits) matched.set(isrc, hit);
    }

    const results = isrcs.map(isrc => {
      const hit = matched.get(isrc);
      return {
        isrc,
        found: (hit?.hitCount ?? 0) > 0,
        songs: (hit?.songs ?? []).map(mapAppleSong),
      };
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
