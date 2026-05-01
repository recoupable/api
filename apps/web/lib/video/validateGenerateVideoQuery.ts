import { z } from "zod";

export const generateVideoQuerySchema = z.object({
  prompt: z
    .string()
    .min(1, "Prompt is required")
    .describe("Text description of the video to generate"),
  seconds: z
    .number()
    .min(4)
    .optional()
    .describe("Duration of the video in seconds (default: 4, max: 20)"),
  size: z
    .enum(["720x1280", "1280x720"])
    .optional()
    .describe("Size of the video: 720x1280 (default portrait), 1280x720 (landscape)"),
});

export type GenerateVideoQuery = z.infer<typeof generateVideoQuerySchema>;
