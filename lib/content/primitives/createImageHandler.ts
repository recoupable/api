import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validatePrimitiveBody } from "./validatePrimitiveBody";
import { createImageBodySchema } from "./schemas";

/**
 * POST /api/content/create/image
 * Generates an AI image using fal.ai inline (no background task).
 *
 * @param request - Incoming request with image generation parameters.
 * @returns JSON with the generated image URL.
 */
export async function createImageHandler(request: NextRequest): Promise<NextResponse> {
  const validated = await validatePrimitiveBody(request, createImageBodySchema);
  if (validated instanceof NextResponse) return validated;

  const falKey = process.env.FAL_KEY;
  if (!falKey) {
    return NextResponse.json(
      { status: "error", error: "FAL_KEY is not configured" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
  fal.config({ credentials: falKey });

  try {
    const { data } = validated;
    const result = await fal.subscribe("fal-ai/nano-banana-pro/edit" as string, {
      input: {
        prompt: data.prompt ?? "portrait photo, natural lighting",
        ...(data.face_guide_url && { image_url: data.face_guide_url }),
      },
    });

    const resultData = result.data as Record<string, unknown>;
    const images = resultData?.images as Array<Record<string, unknown>> | undefined;
    const image = resultData?.image as Record<string, unknown> | undefined;
    const imageUrl = images?.[0]?.url ?? image?.url;

    if (!imageUrl) {
      return NextResponse.json(
        { status: "error", error: "Image generation returned no image" },
        { status: 502, headers: getCorsHeaders() },
      );
    }

    return NextResponse.json({ imageUrl }, { status: 200, headers: getCorsHeaders() });
  } catch (error) {
    console.error("Image generation error:", error);
    return NextResponse.json(
      { status: "error", error: "Image generation failed" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
