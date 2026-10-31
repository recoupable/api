import { z } from "zod";
import { catalogMemberTargetPageSchema } from "./catalogMemberTargetPageSchema";

/** Existing review-only response; aliases never replace raw returned identities. */
export const catalogPlanningResponseSchema = z.strictObject({
  page: catalogMemberTargetPageSchema,
  plan: z
    .array(
      z.strictObject({
        key: z.string(),
        entry: z.literal("catalog"),
        subjectId: z.uuid(),
        targetKind: z.literal("recording"),
        module: z.enum(["musicbrainz", "mlc_recording", "songstats"]),
        executor: z.enum([
          "collectContextMusicBrainz",
          "collectContextMlc:recording",
          "collectContextSongstats",
        ]),
        state: z.literal("blocked"),
        reasons: z.array(z.string()).min(1),
        dependsOn: z.array(z.string()).max(0),
        scope: z.literal("workspace_private"),
        executionStarted: z.literal(false),
      }),
    )
    .max(100),
  collectionPermitted: z.literal(false),
});
