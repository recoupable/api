import { z } from "zod";

/**
 * Zod schema for Apify webhook payloads. Only validates the fields we
 * branch on + read downstream (actorId for dispatch, datasetId for
 * fetch); extra keys from Apify are stripped silently so upstream
 * schema drift does not drop events.
 */
export const apifyPayloadSchema = z.object({
  eventData: z.object({
    actorId: z.string(),
  }),
  resource: z.object({
    defaultDatasetId: z.string(),
  }),
});

export type ApifyPayload = z.infer<typeof apifyPayloadSchema>;
