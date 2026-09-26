import { z } from "zod";
export const conceptPitchSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    activity: z.string().trim().min(1).max(400),
    fanMotivation: z.string().trim().min(1).max(400),
    songOrArtistConnection: z.string().trim().min(1).max(400),
    friendHook: z.string().trim().min(1).max(400),
  })
  .strict();
export const conceptProposalSchema = z.object({
  status: z.enum(["ready", "needs-context", "no-good-concept"]),
  candidates: z.array(conceptPitchSchema).max(3),
  reason: z.string().max(1200),
});
export type ConceptPitch = z.infer<typeof conceptPitchSchema>;
