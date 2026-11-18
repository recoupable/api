import { z } from "zod";
import { reviewSchema } from "./schema";

/** Qualitative evidence is separate from objective journey checks and human approval. */
export const coverHiddenReviewSchema = reviewSchema.extend({
  coverHiddenCritique: z.object({
    assessment: z.enum(["expresses-world", "needs-improvement", "unverified"]),
    reasons: z.array(z.string().min(1).max(1200)).min(1).max(6),
    improvements: z.array(z.string().min(1).max(1200)).max(6),
  }),
});
