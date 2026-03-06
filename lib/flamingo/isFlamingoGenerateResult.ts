/**
 * Response shape from the Music Flamingo /generate endpoint on Modal.
 */
export interface FlamingoGenerateResult {
  /** The model's text response about the music */
  response: string;
  /** Inference time in seconds */
  elapsed_seconds: number;
}

/**
 * Type guard for validating the Music Flamingo generate API response.
 *
 * @param value - Unknown parsed JSON payload
 * @returns True when payload has the expected response and elapsed_seconds fields
 */
export function isFlamingoGenerateResult(
  value: unknown,
): value is FlamingoGenerateResult {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.response === "string" &&
    typeof candidate.elapsed_seconds === "number"
  );
}

