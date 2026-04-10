/**
 * Response shape from the TRIBE v2 /predict endpoint on Modal.
 */
export interface TribePredictResult {
  engagement_score: number;
  engagement_timeline: Array<{ time_seconds: number; score: number }>;
  peak_moments: Array<{ time_seconds: number; score: number }>;
  weak_spots: Array<{ time_seconds: number; score: number }>;
  regional_activation: Record<string, number>;
  total_duration_seconds: number;
  elapsed_seconds: number;
}

/**
 * Type guard for validating the TRIBE v2 predict API response.
 *
 * @param value - Unknown parsed JSON payload.
 * @returns True when payload has the expected engagement metrics shape.
 */
export function isTribePredictResult(value: unknown): value is TribePredictResult {
  if (!value || typeof value !== "object") return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.engagement_score === "number" &&
    Array.isArray(c.engagement_timeline) &&
    Array.isArray(c.peak_moments) &&
    Array.isArray(c.weak_spots) &&
    typeof c.regional_activation === "object" &&
    c.regional_activation !== null &&
    typeof c.total_duration_seconds === "number" &&
    typeof c.elapsed_seconds === "number"
  );
}
