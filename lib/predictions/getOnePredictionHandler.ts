import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { selectPredictionById } from "@/lib/supabase/predictions/selectPredictionById";

/**
 * Handler for GET /api/predictions/:id.
 * Returns a single prediction by UUID.
 *
 * @param request - The incoming request.
 * @param id - The prediction UUID from the URL path.
 * @returns A NextResponse with the prediction or an error.
 */
export async function getOnePredictionHandler(
  request: NextRequest,
  id: string,
): Promise<NextResponse> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  const { accountId } = authResult;

  try {
    const prediction = await selectPredictionById(id);

    if (!prediction) {
      return NextResponse.json(
        { status: "error", error: "Prediction not found" },
        { status: 404, headers: getCorsHeaders() },
      );
    }

    if (prediction.account_id !== accountId) {
      return NextResponse.json(
        { status: "error", error: "Prediction not found" },
        { status: 404, headers: getCorsHeaders() },
      );
    }

    return NextResponse.json(
      {
        status: "success",
        id: prediction.id,
        file_url: prediction.file_url,
        modality: prediction.modality,
        engagement_score: prediction.engagement_score,
        engagement_timeline: prediction.engagement_timeline,
        peak_moments: prediction.peak_moments,
        weak_spots: prediction.weak_spots,
        regional_activation: prediction.regional_activation,
        total_duration_seconds: prediction.total_duration_seconds,
        elapsed_seconds: prediction.elapsed_seconds,
        created_at: prediction.created_at,
      },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch prediction";
    return NextResponse.json(
      { status: "error", error: message },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
