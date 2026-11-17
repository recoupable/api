import { z } from "zod";
import { returnUrlSchema } from "../../fanConnection/schema";
const uuid = z.uuid().transform(value => value.toLowerCase());
export const selectedSitePublicationSchema = z
  .object({
    selection: z
      .object({
        siteId: uuid,
        ownerId: uuid,
        artistId: uuid.nullable(),
        revision: z.number().int().nonnegative().safe(),
        candidateSha256: z.string().regex(/^[a-f0-9]{64}$/),
        expectedPublishedEvidenceId: uuid.nullable(),
        generationToken: z.string().min(1).max(3000).optional(),
      })
      .strict(),
    evidence: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("review"), evidenceId: uuid }).strict(),
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
