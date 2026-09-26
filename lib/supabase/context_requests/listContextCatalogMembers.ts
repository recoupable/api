import { z } from "zod";
import { callContextRpc } from "./callContextRpc";

const pageSchema = z.strictObject({
  catalogId: z.uuid(),
  subjectId: z.uuid(),
  members: z.array(z.string().min(1).max(100)).max(100),
  nextCursor: z.string().min(1).max(100).nullable(),
  hasMore: z.boolean(),
});

/** Owner-scoped catalog ISRCs only; no roster or rights relationship is inferred. */
export async function listContextCatalogMembers(
  owner: string,
  requestId: string,
  subjectId: string,
  afterIsrc?: string,
  limit = 100,
) {
  z.uuid().parse(owner);
  z.uuid().parse(requestId);
  z.uuid().parse(subjectId);
  z.number().int().min(1).max(100).parse(limit);
  if (afterIsrc !== undefined) z.string().min(1).max(100).parse(afterIsrc);
  const page = pageSchema.parse(
    await callContextRpc("list_context_catalog_members", {
      p_owner: owner,
      p_request: requestId,
      p_subject: subjectId,
      p_after_isrc: afterIsrc ?? null,
      p_limit: limit,
    }),
  );
  if (page.subjectId !== subjectId || page.hasMore !== (page.nextCursor !== null))
    throw new Error("Catalog page identity or cursor mismatch");
  return page;
}
