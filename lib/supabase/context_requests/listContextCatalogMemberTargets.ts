import { z } from "zod";
import { callContextRpc } from "./callContextRpc";

const pageSchema = z.strictObject({
  catalogId: z.uuid(),
  catalogSubjectId: z.uuid(),
  members: z
    .array(
      z.strictObject({
        subjectId: z.uuid(),
        kind: z.literal("recording"),
        identityConfirmed: z.literal(true),
        availableFields: z.tuple([z.literal("isrc")]),
        reusableModules: z.array(z.string()),
        isrc: z.string().min(1).max(100),
      }),
    )
    .max(100),
  nextCursor: z.string().min(1).max(100).nullable(),
  hasMore: z.boolean(),
});

/** Expanded and still-current catalog members only; the database rechecks access. */
export async function listContextCatalogMemberTargets(
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
    await callContextRpc("list_context_catalog_member_targets", {
      p_owner: owner,
      p_request: requestId,
      p_subject: subjectId,
      p_after_isrc: afterIsrc ?? null,
      p_limit: limit,
    }),
  );
  if (page.catalogSubjectId !== subjectId || page.hasMore !== (page.nextCursor !== null))
    throw new Error("Catalog member target identity or cursor mismatch");
  return page;
}
