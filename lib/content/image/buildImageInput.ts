import type { z } from "zod";
import type { createImageBodySchema } from "./validateCreateImageBody";
import { loadTemplate } from "@/lib/content/templates";

// Owner ruling 2026-09-01: Muse Image is the house still model. $0.01 an
// image against Nano Banana 2's $0.08 — and NB2 billed 2K at 1.5x ($0.12),
// which is what this file was actually set to. Ids verified against fal
// 2026-09-02; the bare `meta/muse-image` 404s.
const T2I_MODEL = "meta/muse-image/text-to-image";
const EDIT_MODEL = "meta/muse-image/edit";

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
    model = EDIT_MODEL;
    const imageUrls: string[] = [];
    if (refImageUrl) imageUrls.push(refImageUrl);
    if (validated.images) imageUrls.push(...validated.images);
    input.image_urls = imageUrls;
  } else {
    model = T2I_MODEL;
  }

  return { model, input };
}
