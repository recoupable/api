import fal from "@/lib/fal/server";
import { buildScribeInput } from "./buildScribeInput";
import { parseScribeResult } from "./parseScribeResult";

const MODEL = "fal-ai/elevenlabs/speech-to-text/scribe-v2";

/** Internal adapter only: no route/tool registration, persistence, billing or fallback. */
export async function transcribeScribe(input: unknown) {
  const providerInput = buildScribeInput(input);
  const result = await fal.subscribe(MODEL, { input: providerInput }).catch(error => {
    throw new Error("Scribe transcription failed", { cause: error });
  });
  let transcript: ReturnType<typeof parseScribeResult>;
  try {
    transcript = parseScribeResult(result.data);
    if (typeof result.requestId !== "string" || !result.requestId.trim())
      throw new Error("Missing provider request identifier");
  } catch (cause) {
    // Preserve the completed paid request identifier so callers can reconcile, not regenerate.
    throw Object.assign(new Error("Scribe returned unusable word timings", { cause }), {
      requestId: result.requestId,
    });
  }
  return {
    audioUrl: providerInput.audio_url,
    model: MODEL,
    provider: "elevenlabs" as const,
    requestId: result.requestId,
    transcript,
    wordTimings: transcript.words.filter(word => word.type === "word"),
  };
}
