import { z } from "zod";
export const visualMechanismSchema = z.object({
  patternIds: z.array(z.string()).max(3).optional(),
  chapter: z
    .enum(["principles", "compositions", "diagnosis", "build-patterns", "briefs-and-review"])
    .optional(),
  kernel: z.enum(["motion", "experience"]).optional(),
});
