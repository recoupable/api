/** One prompt's answer from the Music Flamingo /generate_batch endpoint. */
export interface FlamingoBatchAnswer {
  /** The `id` the caller gave the prompt. */
  id: string;
  /** The model's text answer. */
  response: string;
  /** Inference time for this prompt alone, in seconds. */
  elapsed_seconds: number;
}

/** Response shape from the Music Flamingo /generate_batch endpoint on Modal. */
export interface FlamingoGenerateBatchResult {
  answers: FlamingoBatchAnswer[];
  /** Wall time for the whole batch, audio download included, in seconds. */
  elapsed_seconds: number;
}

/**
 * Type guard for the Music Flamingo generate_batch response.
 *
 * @param value - Unknown parsed JSON payload.
 * @returns True when the payload has a total `elapsed_seconds` and every
 *   answer carries a string `id`, a string `response` and numeric seconds.
 */
export function isFlamingoGenerateBatchResult(
  value: unknown,
): value is FlamingoGenerateBatchResult {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.elapsed_seconds !== "number" || !Array.isArray(candidate.answers)) {
    return false;
  }
  return candidate.answers.every(answer => {
    if (!answer || typeof answer !== "object") return false;
    const a = answer as Record<string, unknown>;
    return (
      typeof a.id === "string" &&
      typeof a.response === "string" &&
      typeof a.elapsed_seconds === "number"
    );
  });
}
