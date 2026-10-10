import { z } from "zod";
import { playerInputSchema } from "./schema";
export const playerOperationSchemas = {
  create: playerInputSchema,
  list: z.object({ organizationId: z.string().uuid().nullable().default(null) }).strict(),
  get: z
    .object({ id: z.string().uuid(), organizationId: z.string().uuid().nullable().default(null) })
    .strict(),
  update: z
    .object({
      id: z.string().uuid(),
      organizationId: z.string().uuid().nullable().default(null),
      revision: z.number().int().positive(),
      enabled: z.boolean().optional(),
      name: playerInputSchema.shape.name.optional(),
      spotifyUrl: playerInputSchema.shape.spotifyUrl.removeDefault().optional(),
      appleUrl: playerInputSchema.shape.appleUrl.removeDefault().optional(),
      allowedOrigins: playerInputSchema.shape.allowedOrigins.removeDefault().optional(),
      artwork: playerInputSchema.shape.artwork.removeDefault().optional(),
    })
    .strict(),
};
export type PlayerOperation = keyof typeof playerOperationSchemas;
