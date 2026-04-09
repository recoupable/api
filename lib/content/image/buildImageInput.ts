import type { z } from "zod";
import type { createImageBodySchema } from "@/lib/content/schemas";
import { loadTemplate } from "@/lib/content/templates";

const DEFAULT_T2I_MODEL = "fal-ai/nano-banana-2";
const DEFAULT_EDIT_MODEL = "fal-ai/nano-banana-2/edit";

type ImageParams = z.infer<typeof createImageBodySchema>;

interface ImageInput {
  model: string;
  input: Record<string, unknown>;
}

/**
 * Build the fal model name and input payload from validated image params.
 *
 * @param validated - Validated image generation parameters.
 * @returns Object with model name and input payload for fal.subscribe.
 */
export function buildImageInput(validated: ImageParams): ImageInput {
  const tpl = validated.template ? loadTemplate(validated.template) : null;

  const prompt = validated.prompt ?? tpl?.image.prompt ?? "portrait photo, natural lighting";

  const refImageUrl =
    validated.reference_image_url ??
    (tpl?.image.reference_images.length
      ? tpl.image.reference_images[Math.floor(Math.random() * tpl.image.reference_images.length)]
      : undefined);

  const hasReferenceImages = refImageUrl || (validated.images && validated.images.length > 0);

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

  let model: string;

  if (hasReferenceImages) {
    model = validated.model ?? DEFAULT_EDIT_MODEL;
    const imageUrls: string[] = [];
    if (refImageUrl) imageUrls.push(refImageUrl);
    if (validated.images) imageUrls.push(...validated.images);
    input.image_urls = imageUrls;
  } else {
    model = validated.model ?? DEFAULT_T2I_MODEL;
  }

  return { model, input };
}
