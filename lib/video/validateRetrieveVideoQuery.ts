import { z } from "zod";

export const retrieveVideoQuerySchema = z.object({
  video_id: z
    .string()
    .min(1, "Video ID is required")
    .describe("The video ID returned from generate_sora_2_video tool (e.g., 'video_123')"),
});

export type RetrieveVideoQuery = z.infer<typeof retrieveVideoQuerySchema>;
