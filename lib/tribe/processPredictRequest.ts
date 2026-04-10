import { callTribePredict } from "./callTribePredict";
import type { CreatePredictionBody } from "./validateCreatePredictionBody";
import type { TribePredictResult } from "./isTribePredictResult";

interface PredictSuccess extends TribePredictResult {
  type: "success";
}

interface PredictError {
  type: "error";
  error: string;
}

export type PredictResult = PredictSuccess | PredictError;

/**
 * Shared business logic for engagement prediction.
 * Used by both POST /api/predictions and the predict_engagement MCP tool.
 *
 * @param params - Validated prediction request parameters.
 * @returns Discriminated union with type "success" or "error".
 */
export async function processPredictRequest(
  params: CreatePredictionBody,
): Promise<PredictResult> {
  try {
    const result = await callTribePredict(params);
    return { type: "success", ...result };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Engagement prediction failed";
    return { type: "error", error: message };
  }
}
