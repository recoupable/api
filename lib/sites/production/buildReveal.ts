import { z } from "zod";
import { assetSchema, designSchema } from "../schema";
/** Explicit customer-visible output; strips prompts, provider metadata and research. */
export const buildRevealSchema = z.object({
  concept: z.string().max(4000),
  assets: z.array(assetSchema.pick({ name: true, type: true, url: true })),
  preview: z
    .object({
      name: z.string(),
      artistName: z.string().optional(),
      releaseUrl: z.string(),
      assets: z.array(assetSchema.pick({ name: true, type: true, url: true })),
      design: designSchema,
    })
    .optional(),
  refinement: z.string().max(4000).optional(),
});
