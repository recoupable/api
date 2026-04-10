import { TRIBE_PREDICT_URL } from "@/lib/const";
import { isTribePredictResult, type TribePredictResult } from "./isTribePredictResult";
import type { CreatePredictionBody } from "./validateCreatePredictionBody";

/**
 * Calls the TRIBE v2 predict endpoint on Modal.
 * Sends file_url and modality, receives engagement metrics.
 *
 * @param params - Validated prediction request parameters.
 * @returns The engagement prediction result from Modal.
 * @throws Error on network failure or unexpected response shape.
 */
export async function callTribePredict(
  params: CreatePredictionBody,
): Promise<TribePredictResult> {
  const response = await fetch(TRIBE_PREDICT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      file_url: params.file_url,
      modality: params.modality,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    console.error(`TRIBE v2 returned ${response.status}: ${errorText}`);
    throw new Error(`Engagement prediction failed (status ${response.status})`);
  }

  const data = await response.json();
  if (!isTribePredictResult(data)) {
    throw new Error("TRIBE v2 returned an unexpected response shape");
  }
  return data;
}
