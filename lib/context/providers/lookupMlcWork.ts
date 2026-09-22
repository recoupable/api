import { z } from "zod";
/** Fetch one confirmed MLC work. Registry assertions are evidence, not verified legal ownership. */
export async function lookupMlcWork(
  workCode: string,
  accessToken: string,
  fetcher: typeof fetch = fetch,
) {
  z.string()
    .regex(/^[A-Za-z0-9-]{1,100}$/)
    .parse(workCode);
  z.string().min(1).parse(accessToken);
  const sourceUrl = `https://public-api.themlc.com/work/id/${encodeURIComponent(workCode)}`,
    startedAt = new Date().toISOString(),
    start = Date.now();
  const response = await fetcher(sourceUrl, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    signal: AbortSignal.timeout(20000),
    redirect: "error",
  });
  const trace = {
    sourceUrl,
    startedAt,
    httpStatus: response.status,
    elapsedMs: Date.now() - start,
  };
  if (response.status === 404)
    return { status: "not_found", work: null, ownershipVerified: false, trace };
  if (!response.ok) throw new Error(`MLC work lookup HTTP ${response.status}`);
  const raw = await response.json();
  const work = z
    .object({
      mlcSongCode: z.string(),
      iswc: z.string().optional(),
      primaryTitle: z.string().optional(),
      writers: z.array(z.record(z.string(), z.unknown())).optional(),
      publishers: z.array(z.record(z.string(), z.unknown())).optional(),
    })
    .passthrough()
    .parse(raw);
  if (work.mlcSongCode !== workCode) throw new Error("MLC returned a different work");
  return {
    status: "source_found",
    work,
    ownershipVerified: false,
    trace: { ...trace, elapsedMs: Date.now() - start, rawResponse: raw },
    limitations: [
      "Collection shares are not ownership shares.",
      "Territory, effective dates and private agreements require separate evidence.",
    ],
  };
}
