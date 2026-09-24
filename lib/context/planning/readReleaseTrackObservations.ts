import { z } from "zod";

const pageSchema = z.object({
  state: z.enum(["ready", "not_collected", "needs_reconciliation"]),
  sourceResultId: z.uuid().optional(),
  linkedSlots: z.number().int().nonnegative().optional(),
});
const slotSchema = z.object({
  slotIndex: z.number().int().nonnegative(),
  spotifyTrackId: z.string().regex(/^[A-Za-z0-9]{22}$/),
  state: z.enum(["observed", "missing_isrc", "failed"]),
  isrc: z.string().nullable(),
});
const observationSchema = z.object({
  spotifyTrackId: z.string().regex(/^[A-Za-z0-9]{22}$/),
  state: z.enum(["observed", "missing_isrc", "failed"]),
  isrc: z.string().nullable(),
  sourceUrl: z.url(),
  retrievedAt: z.string(),
  elapsedMs: z.number().nonnegative(),
  httpStatus: z.number().int().nullable(),
  gap: z.string().nullable(),
});
const contentSchema = z.object({
  releaseSourceResultId: z.uuid(),
  slots: z.array(slotSchema).max(100),
  observations: z.array(observationSchema).max(100),
  observedIsrcCount: z.number().int().nonnegative(),
  missingIsrcCount: z.number().int().nonnegative(),
  failedLookupCount: z.number().int().nonnegative(),
  coverage: z.enum(["full", "partial"]),
});
const documentSchema = z.object({
  subjectId: z.uuid(),
  topic: z.string(),
  resultId: z.uuid(),
  text: z.string(),
  sources: z
    .array(
      z.object({
        versionId: z.uuid(),
        url: z.string().url(),
        retrievedAt: z.string(),
      }),
    )
    .nullable(),
});

/** Review only current, request-bound observations; never fetch or repair provider evidence. */
export async function readReleaseTrackObservations(
  owner: string,
  requestId: string,
  subjectId: string,
  rpc: (name: string, params: Record<string, unknown>) => Promise<unknown>,
) {
  for (const value of [owner, requestId, subjectId]) z.uuid().parse(value);
  const readPage = () =>
    rpc("list_context_release_track_slots", {
      p_owner: owner,
      p_request: requestId,
      p_subject: subjectId,
      p_after_slot: -1,
      p_limit: 100,
    });
  const page = pageSchema.parse(await readPage());
  if (page.state !== "ready" || !page.sourceResultId)
    return { state: page.state, releaseSourceResultId: page.sourceResultId ?? null };
  const documents = z.array(documentSchema).parse(
    await rpc("read_context_documents", {
      p_owner: owner,
      p_request: requestId,
    }),
  );
  const document = documents.find(
    item => item.subjectId === subjectId && item.topic === "spotify_release_track_isrcs",
  );
  if (!document)
    return { state: "not_collected" as const, releaseSourceResultId: page.sourceResultId };
  const content = contentSchema.parse(JSON.parse(document.text));
  if (content.releaseSourceResultId !== page.sourceResultId)
    return { state: "needs_reconciliation" as const, releaseSourceResultId: page.sourceResultId };
  const fresh = pageSchema.parse(await readPage());
  if (fresh.state !== "ready" || fresh.sourceResultId !== page.sourceResultId)
    return { state: "needs_reconciliation" as const, releaseSourceResultId: page.sourceResultId };
  return {
    state: "ready" as const,
    resultId: document.resultId,
    releaseSourceResultId: page.sourceResultId,
    coverage: content.coverage,
    observedIsrcCount: content.observedIsrcCount,
    missingIsrcCount: content.missingIsrcCount,
    failedLookupCount: content.failedLookupCount,
    slots: content.slots,
    observations: content.observations,
    sources: document.sources ?? [],
  };
}
