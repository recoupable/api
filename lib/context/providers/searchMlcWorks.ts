import { z } from "zod";
const writer = z
  .strictObject({
    writerFirstName: z.string().trim().min(1).max(200).optional(),
    writerLastName: z.string().trim().min(1).max(200).optional(),
    writerIPI: z
      .string()
      .regex(/^\d{9,11}$/)
      .optional(),
  })
  .refine(value => Object.values(value).some(Boolean), "Writer name or IPI required");
const inputSchema = z.strictObject({
  title: z.string().trim().min(1).max(500),
  writers: z.array(writer).min(1).max(30).optional(),
});
/** Search public MLC work candidates. A result never confirms identity, rights or roster membership. */
export async function searchMlcWorks(
  input: z.input<typeof inputSchema>,
  accessToken: string,
  fetcher: typeof fetch = fetch,
) {
  const query = inputSchema.parse(input);
  z.string().min(1).parse(accessToken);
  const sourceUrl = "https://public-api.themlc.com/search/songcode";
  const startedAt = new Date().toISOString(),
    start = Date.now();
  const response = await fetcher(sourceUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(query),
    signal: AbortSignal.timeout(20000),
    redirect: "error",
  });
  if (!response.ok) throw new Error(`MLC work search HTTP ${response.status}`);
  const raw = await response.json();
  const candidates = z
    .array(
      z
        .object({
          mlcSongCode: z.string().min(1),
          workTitle: z.string().optional(),
          iswc: z.string().optional(),
          writers: z.array(z.record(z.string(), z.unknown())).optional(),
        })
        .passthrough(),
    )
    .parse(raw);
  return {
    status:
      candidates.length > 1 ? "needs_review" : candidates.length ? "candidate_found" : "not_found",
    identityConfirmed: false,
    candidates,
    trace: {
      sourceUrl,
      query,
      startedAt,
      elapsedMs: Date.now() - start,
      httpStatus: response.status,
      rawResponse: raw,
      costUsd: null,
    },
    limitations: [
      "Title and writer searches return candidates, not verified identity or ownership.",
      "No exhaustive songwriter catalog is claimed; source search pagination and completeness are unspecified.",
      "Confirm a work code before requesting its publisher and collection-share details.",
    ],
  };
}
