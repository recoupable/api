import { z } from "zod";

export const openingReviewSchema = z.object({
  verdict: z.enum(["pass", "revise"]),
  observations: z
    .array(
      z.object({
        viewport: z.enum(["mobile", "desktop"]),
        invitation: z.string().describe("What this page visibly invites me to do and why."),
        firstAction: z
          .string()
          .describe("What I would do first, using only visible cues; say unclear if guessing."),
        expectedResponse: z
          .string()
          .describe("What I expect my action to change; do not claim to have performed it."),
      }),
    )
    .length(2),
  issues: z
    .array(
      z.object({
        severity: z.literal("blocking"),
        module: z.literal("implementation"),
        detail: z.string(),
        fix: z.string(),
      }),
    )
    .max(4),
  summary: z.string(),
});
