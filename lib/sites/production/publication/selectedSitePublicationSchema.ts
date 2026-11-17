import { z } from "zod";
import { returnUrlSchema } from "../../fanConnection/schema";
export const selectedSitePublicationSchema = z
  .object({
    selection: z
      .object({
        siteId: z.uuid(),
        ownerId: z.uuid(),
        artistId: z.uuid().nullable(),
        revision: z.number().int().nonnegative().safe(),
        candidateSha256: z.string().regex(/^[a-f0-9]{64}$/),
        expectedPublishedEvidenceId: z.uuid().nullable(),
        generationToken: z.string().min(1).max(3000).optional(),
      })
      .strict(),
    evidence: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("review"), evidenceId: z.uuid() }).strict(),
      z
        .object({
          kind: z.literal("override"),
          intent: z.literal("publish-without-passed-review"),
          reason: z.string().trim().min(1).max(2000),
        })
        .strict(),
    ]),
    returnUrl: returnUrlSchema.optional(),
  })
  .strict();
export type SitePublicationSelection = z.infer<typeof selectedSitePublicationSchema>["selection"];
