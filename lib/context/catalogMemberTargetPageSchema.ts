import { z } from "zod";

/** Current expanded recording targets, validated by the existing storage adapter. */
export const catalogMemberTargetPageSchema = z.strictObject({
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
