import { z } from "zod";

/** Matches the App catalog host; the API authorizes references and chooses the reporting window. */
export const catalogSurfaceRequestSchema = z
  .object({
    schemaVersion: z.literal(1),
    workspace: z
      .object({ kind: z.enum(["organization", "account"]), id: z.string().uuid() })
      .strict(),
    subject: z.object({ kind: z.literal("catalog"), id: z.string().uuid() }).strict(),
  })
  .strict();
export type CatalogSurfaceRequest = z.infer<typeof catalogSurfaceRequestSchema>;
