import { z } from "zod";

const scribeInputSchema = z
  .object({
    audio_url: z
      .string()
      .url()
      .refine(value => {
        const url = new URL(value);
        return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password;
      }, "Use an HTTP(S) audio URL without embedded credentials"),
    language_code: z
      .string()
      .regex(/^[a-z]{2,3}$/)
      .optional(),
    diarize: z.boolean().default(false),
  })
  .strict();

/** Explicit Scribe inputs only; unknown options must not silently change paid semantics. */
export function buildScribeInput(input: unknown) {
  return { ...scribeInputSchema.parse(input), tag_audio_events: true };
}
