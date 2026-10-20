import { z } from "zod";

const time = z.number().finite().nonnegative();
const timedWord = z.object({
  type: z.literal("word"),
  text: z.string().refine(text => text.trim().length > 0),
  start: time,
  end: time,
  speaker_id: z.string().optional(),
});
const nonWord = z.object({
  type: z.enum(["spacing", "audio_event"]),
  text: z.string(),
  start: time.optional(),
  end: time.optional(),
  speaker_id: z.string().optional(),
});
const transcriptSchema = z
  .object({
    text: z.string(),
    language_code: z.string().min(1),
    language_probability: z.number().finite().min(0).max(1),
    words: z.array(z.union([timedWord, nonWord])).min(1),
  })
  .superRefine((result, context) => {
    if (!result.words.some(word => word.type === "word")) {
      context.addIssue({ code: "custom", message: "No usable timed words", path: ["words"] });
    }
    result.words.forEach((word, index) => {
      if (word.start !== undefined && word.end !== undefined && word.end < word.start) {
        context.addIssue({ code: "custom", message: "End precedes start", path: ["words", index] });
      }
    });
  });

/** Validate provider timing evidence without inventing timestamps for missing words. */
export function parseScribeResult(data: unknown) {
  return transcriptSchema.parse(data);
}
