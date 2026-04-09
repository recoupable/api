import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validatePrimitiveBody } from "@/lib/content/validatePrimitiveBody";
import fal from "@/lib/fal/server";
import { createImageBodySchema } from "@/lib/content/schemas";
import { buildImageInput } from "./buildImageInput";

/**
 * POST /api/content/image
 *
 * @param request - Incoming request with image generation parameters.
 * @returns JSON with the generated image URL.
 */
export async function createImageHandler(request: NextRequest): Promise<NextResponse> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const validated = await validatePrimitiveBody(request, createImageBodySchema);
  if (validated instanceof NextResponse) return validated;

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
