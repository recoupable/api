import { z } from "zod";
const inputSchema = z.object({
  query: z.string().trim().min(1).max(100),
  type: z.enum(["artists", "tracks", "albums", "songwriters"]),
  offset: z.number().int().nonnegative().default(0),
  limit: z.number().int().min(1).max(100).default(10),
});
/** Candidate discovery for multiple entry types. Access-token scope and quota belong to the caller. */
export async function searchChartmetricContext(
  input: z.input<typeof inputSchema>,
  accessToken: string,
  fetcher: typeof fetch = fetch,
) {
  const parsed = inputSchema.parse(input);
  z.string().min(1).parse(accessToken);
  const query = new URLSearchParams({
    q: parsed.query,
    type: parsed.type,
    offset: String(parsed.offset),
    limit: String(parsed.limit),
  });
  const sourceUrl = `https://api.chartmetric.com/api/search?${query}`,
    startedAt = new Date().toISOString(),
    start = Date.now();
  const response = await fetcher(sourceUrl, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    signal: AbortSignal.timeout(20000),
    redirect: "error",
  });
  if (!response.ok)
    throw new Error(
      `Chartmetric search HTTP ${response.status}; retry-after=${response.headers.get("retry-after") ?? "unknown"}`,
    );
  const raw = await response.json();
  const body = z.object({ obj: z.record(z.string(), z.unknown()) }).parse(raw);
  const candidates = z.array(z.record(z.string(), z.unknown())).parse(body.obj[parsed.type]);
  return {
    status: candidates.length ? "candidates_found" : "not_found",
    candidates,
    identityConfirmed: false,
    nextOffset: candidates.length === parsed.limit ? parsed.offset + parsed.limit : null,
    trace: {
      sourceUrl,
      request: parsed,
      startedAt,
      elapsedMs: Date.now() - start,
      rawResponse: raw,
      rateLimitRemaining: response.headers.get("x-ratelimit-remaining"),
      rateLimitReset: response.headers.get("x-ratelimit-reset"),
      costUsd: null,
      costStatus: "unknown",
    },
    limitations: [
      "Search results require identity matching.",
      "Search snapshots are not dated metric series or ownership evidence.",
    ],
  };
}
