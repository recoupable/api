import { z } from "zod";

const id = z.string().regex(/^[A-Za-z0-9]{22}$/);
const pageSchema = z.object({
  state: z.literal("ready"),
  releaseId: id,
  sourceResultId: z.uuid(),
  coverage: z.string().nullable(),
  collectedSlots: z.number().int().nonnegative(),
  reportedTotal: z.number().int().nonnegative().nullable(),
  linkedSlots: z.number().int().min(0).max(2500),
  unavailableSlots: z.number().int().nonnegative(),
  slots: z.array(
    z.object({
      slotIndex: z.number().int().nonnegative(),
      spotifyTrackId: id,
      discNumber: z.number().int().positive().nullable(),
      trackNumber: z.number().int().positive().nullable(),
      sourceResultId: z.uuid(),
    }),
  ),
  nextCursor: z.number().int().nonnegative().nullable(),
  hasMore: z.boolean(),
});
type Page = z.infer<typeof pageSchema>;

/** Read current source-backed slots before planning track lookups. Makes no provider call. */
export async function loadCurrentReleaseTrackSlots(
  actor: string,
  owner: string,
  requestId: string,
  subjectId: string,
  deps: {
    authorize: (actor: string, owner: string) => Promise<{ ownerId: string }>;
    rpc: (name: string, params: Record<string, unknown>) => Promise<unknown>;
  },
) {
  for (const value of [actor, owner, requestId, subjectId]) z.uuid().parse(value);
  const authorizeSelection = async () => {
    const access = await deps.authorize(actor, owner);
    if (access.ownerId !== owner) throw new Error("Access denied to selected context owner");
  };
  await authorizeSelection();
  const read = (afterSlot: number) =>
    deps.rpc("list_context_release_track_slots", {
      p_owner: owner,
      p_request: requestId,
      p_subject: subjectId,
      p_after_slot: afterSlot,
      p_limit: 100,
    });
  const pages: Page[] = [];
  let cursor = -1;
  for (let index = 0; index < 25; index++) {
    const page = pageSchema.parse(await read(cursor));
    const first = pages[0];
    if (
      first &&
      (page.sourceResultId !== first.sourceResultId ||
        page.releaseId !== first.releaseId ||
        page.linkedSlots !== first.linkedSlots ||
        page.collectedSlots !== first.collectedSlots ||
        page.unavailableSlots !== first.unavailableSlots ||
        page.coverage !== first.coverage ||
        page.reportedTotal !== first.reportedTotal)
    )
      throw new Error("Release source changed during track pagination");
    if (
      page.slots.some(
        (slot, position) =>
          slot.sourceResultId !== page.sourceResultId ||
          slot.slotIndex <= cursor ||
          (position > 0 && slot.slotIndex <= page.slots[position - 1].slotIndex),
      )
    )
      throw new Error("Release track page changed or overlaps");
    pages.push(page);
    if (!page.hasMore) break;
    if (!page.slots.length || page.nextCursor !== page.slots[page.slots.length - 1].slotIndex)
      throw new Error("Release track page has an invalid cursor");
    cursor = page.nextCursor;
  }
  const first = pages[0];
  if (!first || pages[pages.length - 1].hasMore)
    throw new Error("Release track page limit reached");
  const slots = pages.flatMap(page => page.slots);
  if (slots.length !== first.linkedSlots)
    throw new Error("Release track position count changed during pagination");
  await authorizeSelection();
  const fresh = pageSchema.parse(await read(-1));
  if (
    fresh.sourceResultId !== first.sourceResultId ||
    fresh.linkedSlots !== first.linkedSlots ||
    JSON.stringify(fresh.slots) !== JSON.stringify(first.slots)
  )
    throw new Error("Release source changed after track pagination");
  return {
    requestId,
    subjectId,
    releaseId: first.releaseId,
    sourceResultId: first.sourceResultId,
    coverage: first.coverage,
    collectedSlots: first.collectedSlots,
    reportedTotal: first.reportedTotal,
    unavailableSlots: first.unavailableSlots,
    slots,
  };
}
