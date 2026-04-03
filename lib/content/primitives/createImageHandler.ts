import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validatePrimitiveBody } from "./validatePrimitiveBody";
import { configureFal } from "./configureFal";
import { createImageBodySchema } from "./schemas";
import { loadTemplate } from "@/lib/content/templates";

const DEFAULT_T2I_MODEL = "fal-ai/nano-banana-2";
const DEFAULT_EDIT_MODEL = "fal-ai/nano-banana-2/edit";

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

  const falError = configureFal();
  if (falError) return falError;

  try {
    const tpl = validated.template ? loadTemplate(validated.template) : null;

    const prompt = validated.prompt ?? tpl?.image.prompt ?? "portrait photo, natural lighting";

    const refImageUrl =
      validated.reference_image_url ??
      (tpl?.image.reference_images.length
        ? tpl.image.reference_images[Math.floor(Math.random() * tpl.image.reference_images.length)]
        : undefined);

    const hasReferenceImages = refImageUrl || (validated.images && validated.images.length > 0);

    let model: string;
    const input: Record<string, unknown> = {
      prompt: tpl?.image.style_rules
        ? `${prompt}\n\nStyle rules: ${Object.entries(tpl.image.style_rules)
            .map(([k, v]) => `${k}: ${Object.values(v).join(", ")}`)
            .join(". ")}`
        : prompt,
      num_images: validated.num_images,
      aspect_ratio: validated.aspect_ratio,
      resolution: validated.resolution,
      output_format: "png",
      safety_tolerance: "6",
      enable_web_search: true,
      thinking_level: "high",
      limit_generations: true,
    };

    if (hasReferenceImages) {
      model = validated.model ?? DEFAULT_EDIT_MODEL;
      const imageUrls: string[] = [];
      if (refImageUrl) imageUrls.push(refImageUrl);
      if (validated.images) imageUrls.push(...validated.images);
      input.image_urls = imageUrls;
    } else {
      model = validated.model ?? DEFAULT_T2I_MODEL;
    }

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
