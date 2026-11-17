import { z } from "zod";
import { packAudioAnalysisTextSchema } from "./packAudioAnalysisTextSchema";
export const packProductionContextSchema = z.object({
  state: z.literal("complete"),
  audio: z.object({ storage_key: z.string() }),
  references: z.array(z.object({ storage_key: z.string() })),
  summary: packAudioAnalysisTextSchema.max(6000),
  visual_direction: packAudioAnalysisTextSchema.max(2000),
  proposed_start_seconds: z.number(),
  selected_start_seconds: z.number(),
  duration_seconds: z.number(),
});
