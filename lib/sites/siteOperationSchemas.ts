import { returnUrlSchema } from "./fanConnection/schema";
import { z } from "zod";
import { conceptPitchSchema } from "./production/conceptSchema";
import { siteInputSchema } from "./schema";
const id = z.string().uuid();
const revision = z.number().int().nonnegative();
export const siteOperationSchemas = {
  list: z.object({ organizationId: id.nullable().optional(), artistId: id.optional() }).strict(),
  get: z.object({ id }).strict(),
  signups: z.object({ id }).strict(),
  create: siteInputSchema,
  concepts: z
    .object({
      id,
      revision,
      instruction: z.string().trim().max(6000).default(""),
      contextBriefId: id.optional(),
    })
    .strict(),
  generate: z
    .object({
      id,
      revision,
      instruction: z.string().trim().max(6000).default(""),
      approvedConcept: conceptPitchSchema.optional(),
      background: z.boolean().default(true),
      contextBriefId: z.string().uuid().optional(),
    })
    .strict(),
  generation: z.object({ id, token: z.string().min(1).max(3000) }).strict(),
  publish: z.object({ id, revision, returnUrl: returnUrlSchema.optional() }).strict(),
  unpublish: z.object({ id, revision }).strict(),
};
export type SiteOperation = keyof typeof siteOperationSchemas;
