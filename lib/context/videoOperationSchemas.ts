import { z } from "zod";
import { contextIngestSchema } from "./schema";
import { parseContextVideoUrl } from "./parseContextVideoUrl";

/** A video locator accepts no topics or direction: nothing is collected or interpreted when it is saved. */
export const videoOperationSchemas = [
  z.strictObject({
    action: z.literal("ingest_video"),
    url: z
      .url()
      .max(2048)
      .refine(value => {
        try {
          parseContextVideoUrl(value);
          return true;
        } catch {
          return false;
        }
      }, "Use a single YouTube video URL; Spotify tracks use ingest"),
    organization_id: z.uuid().optional(),
    idempotency_key: contextIngestSchema.shape.idempotency_key,
  }),
] as const;
export type VideoOperation = z.infer<(typeof videoOperationSchemas)[number]>;
