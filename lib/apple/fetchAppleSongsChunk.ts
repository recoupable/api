import type { AppleCatalogSong, AppleCatalogSongsResponse } from "./catalogTypes";

const APPLE_MUSIC_API = "https://api.music.apple.com";

/**
 * Per requested ISRC: how many songs `meta.filters` says Apple matched, and the
 * ones resolved from `data`. `hitCount` is the authority on existence — it is
 * what `found` is derived from, so a hit that fails to resolve can never be
 * mistaken for a takedown.
 */
export type AppleChunkHits = Map<string, { hitCount: number; songs: AppleCatalogSong[] }>;

function buildUrl(isrcs: string[], storefront: string): string {
  // No `limit`: Apple ignores it on identifier filters and returns every match
  // (verified 2026-08-17 — limit=2 against 10 matches still returned all 10, no `next`).
  const params = new URLSearchParams({
    "filter[isrc]": isrcs.join(","),
    include: "albums",
    extend: "composerName,audioVariants",
  });
  return `${APPLE_MUSIC_API}/v1/catalog/${storefront}/songs?${params}`;
}

/**
 * Fetches one chunk of ISRCs from the Apple Music catalog.
 *
 * Keys the result off `meta.filters.isrc` rather than `data[].attributes.isrc`:
 * the meta map is the only place a requested-but-unmatched ISRC appears, and
 * matching on the attribute silently drops any song whose ISRC differs from the
 * request.
 *
 * @param isrcs - At most `MAX_ISRCS_PER_REQUEST` ISRCs.
 * @param storefront - Two-letter Apple Music storefront code.
 * @param token - An Apple Music developer token.
 * @returns Every requested ISRC mapped to the songs Apple matched.
 * @throws If Apple responds with a non-2xx status.
 */
export async function fetchAppleSongsChunk(
  isrcs: string[],
  storefront: string,
  token: string,
): Promise<AppleChunkHits> {
  const response = await fetch(buildUrl(isrcs, storefront), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Apple Music API responded ${response.status}: ${await response.text()}`);
  }

  const body = (await response.json()) as AppleCatalogSongsResponse;
  const songsById = new Map((body.data ?? []).map(song => [song.id, song]));

  return new Map(
    Object.entries(body.meta?.filters?.isrc ?? {}).map(([isrc, hits]) => [
      isrc,
      {
        hitCount: hits.length,
        songs: hits
          .map(hit => songsById.get(hit.id))
          .filter((song): song is AppleCatalogSong => !!song),
      },
    ]),
  );
}
