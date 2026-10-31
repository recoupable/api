import { generateText, type LanguageModel } from "ai";
import { z } from "zod";
import { packCandidateAdapterSettings } from "@/lib/const";
import { parsePackAudioAnalysis } from "./parsePackAudioAnalysis";

/** Unwired candidate. Caller must supply an explicit model and already authorized audio bytes. */
export async function analyzePackAudioWithGemini(input: {
  model: Exclude<LanguageModel, string>;
  bytes: Uint8Array;
  mediaType: string;
  prompt: string;
  durationSeconds: number;
  clipSeconds: number;
}) {
  const settings = packCandidateAdapterSettings.audio;
  if (input.model.modelId !== settings.modelId || input.model.provider !== settings.provider)
    throw new Error(
      "Audio candidate requires the qualified Gemini model and direct Google transport",
    );
  z.object({
    bytes: z
      .instanceof(Uint8Array)
      .refine(bytes => bytes.length > 0 && bytes.length <= 10 * 1024 * 1024),
    mediaType: z.enum([
      "audio/wav",
      "audio/mpeg",
      "audio/mp3",
      "audio/aiff",
      "audio/aac",
      "audio/ogg",
      "audio/flac",
    ]),
    prompt: z
      .string()
      .min(1)
      .max(12_000)
      .refine(text => text.trim().length > 0),
    durationSeconds: z.number().positive().max(1200),
    clipSeconds: z.number().positive(),
  })
    .refine(value => value.clipSeconds <= value.durationSeconds)
    .parse(input);
  const result = await generateText({
    model: input.model,
    maxOutputTokens: settings.maxOutputTokens,
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(90_000),
    providerOptions: {
      google: { thinkingConfig: { thinkingLevel: "low", includeThoughts: false } },
    },
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: input.prompt },
          { type: "file", data: input.bytes, mediaType: input.mediaType },
        ],
      },
    ],
  });
  if (result.finishReason !== "stop")
    throw new Error("Audio analysis is incomplete; reconcile before another attempt");
  return parsePackAudioAnalysis(result.text, input.durationSeconds, input.clipSeconds);
}
