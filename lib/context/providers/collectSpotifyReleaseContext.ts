import { z } from "zod";
const id = z.string().regex(/^[A-Za-z0-9]{22}$/);
const pageSchema = z
  .object({
    items: z.array(z.unknown()),
    next: z.string().nullable(),
    total: z.number().int().nonnegative(),
    offset: z.number().int().nonnegative(),
  })
  .passthrough();
const albumSchema = z.object({ id, name: z.string(), tracks: pageSchema }).passthrough();
/** Bounded source reader. Preserves raw track slots (including unavailable items); no identity merges or DB writes. */
export async function collectSpotifyReleaseContext(
  input: { releaseId: string; market?: string; maxPages?: number },
  accessToken: string,
  fetcher: typeof fetch = fetch,
) {
  const args = z
    .strictObject({
      releaseId: id,
      market: z
        .string()
        .regex(/^[A-Z]{2}$/)
        .optional(),
      maxPages: z.number().int().min(1).max(50).default(10),
    })
    .parse(input);
  const firstUrl = new URL(`https://api.spotify.com/v1/albums/${args.releaseId}`);
  if (args.market) firstUrl.searchParams.set("market", args.market);
  const snapshots: Array<{
    url: string;
    startedAt: string;
    elapsedMs: number;
    httpStatus: number;
    payload: unknown;
  }> = [];
  const read = async (url: string) => {
    const startedAt = new Date().toISOString(),
      start = Date.now();
    const response = await fetcher(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      redirect: "error",
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      snapshots.push({
        url,
        startedAt,
        elapsedMs: Date.now() - start,
        httpStatus: response.status,
        payload: null,
      });
      throw new Error(`Spotify HTTP ${response.status}`);
    }
    const payload: unknown = await response.json();
    snapshots.push({
      url,
      startedAt,
      elapsedMs: Date.now() - start,
      httpStatus: response.status,
      payload,
    });
    return payload;
  };
  const album = albumSchema.parse(await read(firstUrl.href));
  if (album.id !== args.releaseId) throw new Error("Spotify release identity mismatch");
  if (album.tracks.offset !== 0)
    throw new Error("Spotify release first page has unexpected offset");
  const pages = [album.tracks];
  const visited = new Set<string>();
  let next = album.tracks.next;
  const gaps: string[] = [];
  while (next && pages.length < args.maxPages) {
    try {
      const url = new URL(next);
      if (
        url.origin !== "https://api.spotify.com" ||
        url.username ||
        url.password ||
        url.hash ||
        url.pathname !== `/v1/albums/${args.releaseId}/tracks`
      )
        throw new Error("Unexpected Spotify pagination URL");
      if (visited.has(url.href)) throw new Error("Repeated Spotify track page");
      visited.add(url.href);
      const page = pageSchema.parse(await read(url.href));
      const previous = pages[pages.length - 1];
      if (
        page.offset !== previous.offset + previous.items.length ||
        page.total !== album.tracks.total
      )
        throw new Error("Spotify track pages changed or overlap");
      pages.push(page);
      next = page.next;
    } catch {
      gaps.push("Remaining track pages could not be verified or fetched; no automatic retry");
      break;
    }
  }
  if (next && !gaps.length) gaps.push("Track page limit reached");
  const tracks = pages.flatMap(page => page.items);
  if (tracks.length !== album.tracks.total)
    gaps.push("Collected track slots differ from the provider total");
  return {
    releaseId: args.releaseId,
    album,
    pages,
    tracks,
    trackCoverage: {
      extent: !next && !gaps.length ? "full" : "partial",
      collectedSlots: tracks.length,
      reportedTotal: album.tracks.total,
      next,
    },
    coverage: "partial",
    ownershipVerified: false,
    snapshots,
    gaps,
    limitations: [
      "Full track pagination does not mean full release context. Track slots may be unavailable; no missing identifiers are invented.",
      "Label and copyright notices do not verify rights shares. Snapshot freshness is limited to this collection time.",
      "Source reader only; no database persistence, audio lookup, artist enrichment or automatic retries.",
    ],
  };
}
