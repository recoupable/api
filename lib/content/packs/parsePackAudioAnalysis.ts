import { z } from "zod";
import { packAudioAnalysisTextSchema } from "./packAudioAnalysisTextSchema";

/** Apply the same descriptive analysis and excerpt bounds to every audio adapter. */
export function parsePackAudioAnalysis(text: string, durationSeconds: number, clipSeconds: number) {
  let raw: unknown;
  try {
    raw = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    throw new Error(
      "Audio analysis did not return a usable bounded excerpt proposal; no visual generation started",
    );
  }
  return z
    .object({
      summary: packAudioAnalysisTextSchema.max(6000),
      visual_direction: packAudioAnalysisTextSchema.max(2000),
      proposed_start_seconds: z
        .number()
        .min(0)
        .max(durationSeconds - clipSeconds),
    })
    .parse(raw);
}
