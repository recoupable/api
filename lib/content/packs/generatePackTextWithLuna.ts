import { generateText, type LanguageModel } from "ai";
import { z } from "zod";
import { packCandidateAdapterSettings } from "@/lib/const";

type Input = {
  model: Exclude<LanguageModel, string>;
  prompt: string;
} & ({ stage: "caption" } | { stage: "stillInspection"; image: Uint8Array; mediaType: string });

/** Unwired text/image candidate; inspection text still requires the existing judgment parser. */
export async function generatePackTextWithLuna(input: Input): Promise<string> {
  const settings = packCandidateAdapterSettings.text;
  if (input.model.modelId !== settings.modelId || input.model.provider !== settings.provider)
    throw new Error("Text candidate requires the qualified Luna model and OpenAI chat transport");
  z.string().trim().min(1).parse(input.prompt);
  if (input.stage === "stillInspection") {
    z.instanceof(Uint8Array)
      .refine(bytes => bytes.length > 0)
      .parse(input.image);
    z.enum(["image/png", "image/jpeg", "image/webp"]).parse(input.mediaType);
  }
  const result = await generateText({
    model: input.model,
    maxOutputTokens: input.stage === "caption" ? settings.captionTokens : settings.inspectionTokens,
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(30_000),
    // This SDK does not auto-detect GPT-6: force max_completion_tokens serialization.
    providerOptions: { openai: { forceReasoning: true, reasoningEffort: "none" } },
    ...(input.stage === "caption"
      ? {
          system:
            "Write one concise, distinctive music campaign caption grounded only in the brief. No invented quotes or facts. Return plain text only.",
        }
      : {}),
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: input.prompt },
          ...(input.stage === "stillInspection"
            ? [{ type: "image" as const, image: input.image, mediaType: input.mediaType }]
            : []),
        ],
      },
    ],
  });
  if (result.finishReason !== "stop")
    throw new Error("Text generation is incomplete; reconcile before another attempt");
  const text = result.text.trim();
  if (!text) throw new Error("Text generation returned no text");
  return text;
}
