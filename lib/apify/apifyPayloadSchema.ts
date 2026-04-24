import { z } from "zod";

/**
 * Zod schema for Apify webhook payloads. Only validates the fields we
 * branch on + read downstream; the rest of the payload is intentionally
 * permissive so Apify schema drift does not drop events.
 */
export const apifyPayloadSchema = z.object({
  userId: z.any(),
  createdAt: z.any(),
  eventType: z.any(),
  eventData: z.object({
    actorId: z.string(),
  }),
  resource: z.object({
    defaultDatasetId: z.string(),
  }),
});

export type ApifyPayload = z.infer<typeof apifyPayloadSchema>;
