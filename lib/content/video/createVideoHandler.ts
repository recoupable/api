import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateCreateVideoBody } from "./validateCreateVideoBody";
import { generateVideo, HOUSE_VIDEO_MODEL } from "./generateVideo";
import { ensureVideoCredits } from "@/lib/content/ensureVideoCredits";
import { chargeForGeneration } from "@/lib/content/chargeForGeneration";
import { creditCostForVideoUnits } from "@/lib/content/creditCostForVideoUnits";
import { estimateVideoUnits } from "@/lib/content/estimateVideoUnits";

/**
 * POST /api/content/video
 *
 * @param request - Incoming request with video generation parameters.
 * @returns JSON with the generated video URL.
 */
export async function createVideoHandler(request: NextRequest): Promise<NextResponse> {
  const validated = await validateCreateVideoBody(request);
  if (validated instanceof NextResponse) return validated;

  try {
    const short = await ensureVideoCredits(
      validated.accountId,
      validated.duration,
      validated.resolution,
    );
    if (short) return short;

    const { videoUrl, requestId } = await generateVideo(validated);

    await chargeForGeneration({
      accountId: validated.accountId,
      endpointId: HOUSE_VIDEO_MODEL,
      requestId,
      fallbackUnits: estimateVideoUnits(validated.duration, validated.resolution),
      creditsForUnits: creditCostForVideoUnits,
    });

    return NextResponse.json({ videoUrl }, { status: 200, headers: getCorsHeaders() });
  } catch (error) {
    console.error("Video generation error:", error);
    const message = error instanceof Error ? error.message : "Video generation failed";
    const status = message.includes("no video") ? 502 : 500;
    return NextResponse.json(
      { status: "error", error: message },
      { status, headers: getCorsHeaders() },
    );
  }
}
