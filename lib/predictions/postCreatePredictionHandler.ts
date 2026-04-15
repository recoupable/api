import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validateCreatePredictionBody } from "@/lib/tribe/validateCreatePredictionBody";
import { processPredictRequest } from "@/lib/tribe/processPredictRequest";
import { insertPrediction } from "@/lib/supabase/predictions/insertPrediction";

/**
 * Handler for POST /api/predictions.
 * Authenticates, validates body, runs TRIBE v2 via Modal, persists result.
 *
 * @param request - The incoming request with a JSON body.
 * @returns A NextResponse with the prediction result or an error.
 */
export async function postCreatePredictionHandler(
  request: NextRequest,
): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { status: "error", error: "Request body must be valid JSON" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  const { accountId } = authResult;

  const validated = validateCreatePredictionBody(body);
  if (validated instanceof NextResponse) {
    return validated;
  }

  const result = await processPredictRequest(validated);

  if (result.type === "error") {
    return NextResponse.json(
      { status: "error", error: result.error },
      { status: 500, headers: getCorsHeaders() },
    );
  }

  const { type: _, ...metrics } = result;

  try {
    const row = await insertPrediction({
      account_id: accountId,
      file_url: validated.file_url,
      modality: validated.modality,
      engagement_score: metrics.engagement_score,
      engagement_timeline: metrics.engagement_timeline,
      peak_moments: metrics.peak_moments,
      weak_spots: metrics.weak_spots,
      regional_activation: metrics.regional_activation,
      total_duration_seconds: metrics.total_duration_seconds,
      elapsed_seconds: metrics.elapsed_seconds,
    });

    return NextResponse.json(
      {
        status: "success",
        id: row.id,
        file_url: row.file_url,
        modality: row.modality,
        engagement_score: row.engagement_score,
        engagement_timeline: row.engagement_timeline,
        peak_moments: row.peak_moments,
        weak_spots: row.weak_spots,
        regional_activation: row.regional_activation,
        total_duration_seconds: row.total_duration_seconds,
        elapsed_seconds: row.elapsed_seconds,
        created_at: row.created_at,
      },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save prediction";
    return NextResponse.json(
      { status: "error", error: message },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
