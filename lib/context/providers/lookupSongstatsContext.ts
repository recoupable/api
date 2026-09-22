import { z } from "zod";
import type { fetchSongstats } from "@/lib/songstats/fetchSongstats";
const spotifyId = z.string().regex(/^[A-Za-z0-9]{22}$/);
const schema = z.union([
  z.strictObject({
    kind: z.literal("recording"),
    isrc: z
      .string()
      .transform(s => s.replace(/-/g, "").toUpperCase())
      .pipe(z.string().regex(/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/)),
  }),
  z.strictObject({ kind: z.literal("recording"), spotifyId }),
  z.strictObject({ kind: z.literal("artist"), spotifyId }),
]);
/** One aggregator lookup using Recoup's existing client. Caller owns authorization and any spend approval. */
export async function lookupSongstatsContext(
  input: z.input<typeof schema>,
  fetcher?: typeof fetchSongstats,
) {
  const args = schema.parse(input);
  const path = args.kind === "artist" ? "/artists/info" : "/tracks/info";
  const query: Record<string, string> =
    "isrc" in args
      ? { isrc: args.isrc }
      : "spotifyId" in args
        ? args.kind === "artist"
          ? { spotify_artist_id: args.spotifyId }
          : { spotify_track_id: args.spotifyId }
        : {};
  const call = fetcher ?? (await import("@/lib/songstats/fetchSongstats")).fetchSongstats;
  const startedAt = new Date().toISOString(),
    start = Date.now();
  const result = await call(path, query);
  const trace = {
    provider: "Songstats",
    sourceUrl: `https://api.songstats.com/enterprise/v1${path}`,
    query,
    startedAt,
    elapsedMs: Date.now() - start,
    httpStatus: result.status,
    costUsd: null,
  };
  if (result.status === 404)
    return {
      status: "not_found",
      evidence: null,
      identityConfirmed: false,
      scope: "workspace_private",
      trace,
    };
  if (result.status !== 200) throw new Error(`Songstats context lookup HTTP ${result.status}`);
  const evidence = z.record(z.string(), z.unknown()).parse(result.data);
  if (evidence.error || evidence.result === "error")
    throw new Error("Songstats returned an error payload");
  return {
    status: Object.keys(evidence).length ? "source_returned" : "not_found",
    evidence,
    identityConfirmed: false,
    scope: "workspace_private",
    trace,
    limitations: [
      "Aggregator evidence, not a direct DSP response. Preserve returned platform IDs and URLs without silently merging identities.",
      "Fields and source freshness depend on the provider response; absent fields remain unknown.",
      "Provider licensing and workspace access must be checked before wider reuse. No automatic retry.",
    ],
  };
}
