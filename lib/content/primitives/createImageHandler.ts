import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validatePrimitiveBody } from "./validatePrimitiveBody";
import { createImageBodySchema } from "./schemas";

const DEFAULT_MODEL = "fal-ai/nano-banana-pro/edit";

/**
 * POST /api/content/generate-image
 *
 * @param request - Incoming request with image generation parameters.
 * @returns JSON with the generated image URL.
 */
export async function createImageHandler(request: NextRequest): Promise<NextResponse> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

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
    const result = await fal.subscribe(validated.model ?? DEFAULT_MODEL, {
      input: {
        prompt: validated.prompt ?? "portrait photo, natural lighting",
        ...(validated.reference_image_url && { image_url: validated.reference_image_url }),
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
