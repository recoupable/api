import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import fal from "@/lib/fal/server";
import { validateCreateImageBody } from "./validateCreateImageBody";
import { buildImageInput } from "./buildImageInput";
import { ensureImageCredits } from "@/lib/content/ensureContentCredits";
import { getFalBillableUnits } from "@/lib/fal/getFalBillableUnits";
import { deductCredits } from "@/lib/credits/deductCredits";
import { creditCostForImageUnits } from "@/lib/content/creditCostForContent";

/**
 * POST /api/content/image
 *
 * @param request - Incoming request with image generation parameters.
 * @returns JSON with the generated image URL.
 */
export async function createImageHandler(request: NextRequest): Promise<NextResponse> {
  const validated = await validateCreateImageBody(request);
  if (validated instanceof NextResponse) return validated;

  const short = await ensureImageCredits(validated.accountId, validated.num_images);
  if (short) return short;

  try {
    const { model, input } = buildImageInput(validated);
    const result = await fal.subscribe(model, { input });

    const resultData = result.data as Record<string, unknown>;
    const imageList = resultData?.images as Array<Record<string, unknown>> | undefined;

    if (!imageList || imageList.length === 0) {
      return NextResponse.json(
        { status: "error", error: "Image generation returned no image" },
        { status: 502, headers: getCorsHeaders() },
      );
    }

    const urls = imageList.map(img => img.url as string).filter(Boolean);

    // fal has already been paid at this point — a failure below must not
    // turn a successful generation into an error response. One image is one
    // billable unit, unaffected by resolution or aspect ratio, so
    // num_images is an exact fallback if the header read fails.
    const units = (await getFalBillableUnits(model, result.requestId)) ?? validated.num_images;
    try {
      await deductCredits({
        accountId: validated.accountId,
        creditsToDeduct: creditCostForImageUnits(units),
      });
    } catch (error) {
      console.error(
        `[createImageHandler] deductCredits failed for request ${result.requestId}:`,
        error,
      );
    }

    return NextResponse.json(
      { imageUrl: urls[0], images: urls },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("Image generation error:", error);
    return NextResponse.json(
      { status: "error", error: "Image generation failed" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
