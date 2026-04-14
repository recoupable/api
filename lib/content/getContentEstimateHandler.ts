import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateGetContentEstimateQuery } from "@/lib/content/validateGetContentEstimateQuery";

const BASE_IMAGE_TO_VIDEO_COST = 0.82;
const BASE_AUDIO_TO_VIDEO_COST = 0.95;

/**
 * Get Content Estimate Handler.
 *
 * @param request - Parameter.
 * @returns - Result.
 */
export async function getContentEstimateHandler(request: NextRequest): Promise<NextResponse> {
  const validated = await validateGetContentEstimateQuery(request);
  if (validated instanceof NextResponse) {
    return validated;
  }

  const perVideoEstimate = validated.lipsync ? BASE_AUDIO_TO_VIDEO_COST : BASE_IMAGE_TO_VIDEO_COST;
  const totalEstimate = Number((perVideoEstimate * validated.batch).toFixed(2));

  const response: Record<string, unknown> = {
    status: "success",
    lipsync: validated.lipsync,
    batch: validated.batch,
    per_video_estimate_usd: perVideoEstimate,
    total_estimate_usd: totalEstimate,
  };

  if (validated.compare) {
    response.profiles = {
      budget: 0.18,
      mid: 0.62,
      current: validated.lipsync ? BASE_AUDIO_TO_VIDEO_COST : BASE_IMAGE_TO_VIDEO_COST,
    };
  }

  return NextResponse.json(response, { status: 200, headers: getCorsHeaders() });
}
