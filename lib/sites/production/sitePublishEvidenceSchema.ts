import { z } from "zod";
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const recordSchema = z.object({
  id: z.string().min(1),
  siteId: z.string().min(1),
  ownerId: z.string().min(1),
  revision: z.number().int().nonnegative().safe(),
  candidateSha256: hash,
  recordedByAccountId: z.string().min(1),
  recordedAt: z.string().datetime(),
});
export const sitePublishEvidenceSchema = z.discriminatedUnion("kind", [
  recordSchema.extend({ kind: z.literal("review"), review: z.unknown(), reviewSha256: hash }),
  recordSchema.extend({
    kind: z.literal("override"),
    intent: z.literal("publish-without-passed-review"),
    reason: z.string().trim().min(1).max(2000),
  }),
]);
