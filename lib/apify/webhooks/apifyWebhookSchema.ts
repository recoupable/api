import { z } from "zod";

export const apifyWebhookSchema = z.object({
  userId: z.string(),
  createdAt: z.string(),
  eventType: z.string(),
  eventData: z.object({
    actorId: z.string(),
  }),
  resource: z.object({
    defaultDatasetId: z.string(),
  }),
});

export type ApifyWebhookPayload = z.infer<typeof apifyWebhookSchema>;
