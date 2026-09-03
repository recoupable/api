import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateCreateVideoBody } from "./validateCreateVideoBody";
import { generateVideo, HOUSE_VIDEO_MODEL } from "./generateVideo";
import { ensureVideoCredits } from "@/lib/content/ensureContentCredits";
import { getFalBillableUnits } from "@/lib/fal/getFalBillableUnits";
import { deductCredits } from "@/lib/credits/deductCredits";
import { creditCostForVideoUnits, estimateVideoUnits } from "@/lib/content/creditCostForContent";

/**
 * POST /api/content/video
 *
 * @param request - Incoming request with video generation parameters.
 * @returns JSON with the generated video URL.
 */
export async function createVideoHandler(request: NextRequest): Promise<NextResponse> {
  const validated = await validateCreateVideoBody(request);
  if (validated instanceof NextResponse) return validated;

  const short = await ensureVideoCredits(
    validated.accountId,
    validated.duration,
    validated.resolution,
  );
  if (short) return short;

  try {
    const { videoUrl, requestId } = await generateVideo(validated);

    // fal has already been paid at this point — a failure below must not
    // turn a successful generation into an error response. The real unit
    // count comes straight off the result response fal.subscribe already
    // fetched; billing-events reports the same number but lags ~15s, too
    // slow to charge on here. Falls back to our own estimate if the read
    // fails for any reason.
    const units =
      (await getFalBillableUnits(HOUSE_VIDEO_MODEL, requestId)) ??
      estimateVideoUnits(validated.duration, validated.resolution);
    try {
      await deductCredits({
        accountId: validated.accountId,
        creditsToDeduct: creditCostForVideoUnits(units),
      });
    } catch (error) {
      console.error(`[createVideoHandler] deductCredits failed for request ${requestId}:`, error);
    }

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
