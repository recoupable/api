import { z } from "zod";
/** MLC OpenAPI /search/recordings. Caller provides an authorized token; no cross-workspace credential fallback. */
export async function lookupMlcRecording(
  input: string,
  accessToken: string,
  fetcher: typeof fetch = fetch,
) {
  const isrc = z
    .string()
    .regex(/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/)
    .parse(input.replace(/-/g, "").toUpperCase());
  z.string().min(1).parse(accessToken);
  const sourceUrl = "https://public-api.themlc.com/search/recordings",
    startedAt = new Date().toISOString(),
    start = Date.now();
  const response = await fetcher(sourceUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ isrc }),
    signal: AbortSignal.timeout(20000),
    redirect: "error",
  });
  if (!response.ok) throw new Error(`MLC recording lookup HTTP ${response.status}`);
  const raw = await response.json();
  const rows = z
    .array(
      z
        .object({
          isrc: z.string().optional(),
          mlcsongCode: z.string().optional(),
          title: z.string().optional(),
          artist: z.string().optional(),
        })
        .passthrough(),
    )
    .parse(raw);
  const candidates = rows.filter(row => row.isrc?.replace(/-/g, "").toUpperCase() === isrc);
  return {
    status:
      candidates.length > 1 ? "needs_review" : candidates.length ? "candidate_found" : "not_found",
    candidates,
    rejectedCount: rows.length - candidates.length,
    trace: {
      sourceUrl,
      request: { isrc },
      startedAt,
      elapsedMs: Date.now() - start,
      httpStatus: response.status,
      rawResponse: raw,
    },
    limitations: [
      "Recording-to-work candidates require identity review.",
      "No ownership, publisher or collection share is inferred from a recording match.",
    ],
  };
}
