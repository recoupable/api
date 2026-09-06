/**
 * Response shape from the Music Flamingo /generate endpoint on Modal.
 */
export interface FlamingoGenerateResult {
  /** The model's text response about the music */
  response: string;
  /** Inference time in seconds */
  elapsed_seconds: number;
  /**
   * What the call cost us in dollars: the workspace's live A100 rate × the
   * seconds measured, computed on Modal. Absent from deployments that
   * predate it; the api then prices on `elapsed_seconds` at a pinned rate.
   */
  cost_usd?: number;
}

/**
 * Type guard for validating the Music Flamingo generate API response.
 *
 * @param value - Unknown parsed JSON payload
 * @returns True when payload has the expected response and elapsed_seconds fields
 */
export function isFlamingoGenerateResult(value: unknown): value is FlamingoGenerateResult {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.response === "string" &&
    typeof candidate.elapsed_seconds === "number" &&
    (candidate.cost_usd === undefined || typeof candidate.cost_usd === "number")
  );
}
