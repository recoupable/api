import { z } from "zod";
import { callContextRpc } from "./callContextRpc";

const pageSchema = z.strictObject({
  catalogId: z.uuid(),
  catalogSubjectId: z.uuid(),
  members: z
    .array(z.strictObject({ subjectId: z.uuid(), isrc: z.string().min(1).max(100) }))
    .max(100),
  nextCursor: z.string().min(1).max(100).nullable(),
  hasMore: z.boolean(),
});

/** Persist one bounded catalog-member page; this asserts no roster or rights relationship. */
export async function expandContextCatalogMembers(
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
    await callContextRpc("expand_context_catalog_members", {
      p_owner: owner,
      p_request: requestId,
      p_subject: subjectId,
      p_after_isrc: afterIsrc ?? null,
      p_limit: limit,
    }),
  );
  if (page.catalogSubjectId !== subjectId || page.hasMore !== (page.nextCursor !== null))
    throw new Error("Catalog expansion identity or cursor mismatch");
  return page;
}
