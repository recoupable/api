import type { z } from "zod";
import type { createImageBodySchema } from "./validateCreateImageBody";

// Owner ruling 2026-09-01: Muse Image is the house still model. Ids verified
// against fal 2026-09-02; the bare `meta/muse-image` 404s.
const T2I_MODEL = "meta/muse-image/text-to-image";
const EDIT_MODEL = "meta/muse-image/edit";

type ImageParams = z.infer<typeof createImageBodySchema>;

interface ImageInput {
  model: string;
  input: Record<string, unknown>;
}

/**
 * Maps the validated request body to Muse Image's real fal input shape.
 *
 * Every field here is one Muse Image actually accepts (verified against
 * fal's OpenAPI schema for `meta/muse-image/text-to-image` and `.../edit`,
 * recoupable/app#2052) — no `resolution`, `safety_tolerance`,
 * `enable_web_search`, or `thinking_level`, none of which exist on this
 * model; those were leftover Nano Banana 2 fields.
 *
 * @param validated - The validated request body.
 * @returns The fal model id and input for the resolved mode.
 */
export function buildImageInput(validated: ImageParams): ImageInput {
  const prompt = validated.prompt ?? "portrait photo, natural lighting";
  const hasReferenceImages = !!validated.image_urls?.length;

  const input: Record<string, unknown> = {
    prompt,
    num_images: validated.num_images,
    output_format: validated.output_format,
    sync_mode: validated.sync_mode,
    ...(validated.aspect_ratio && { aspect_ratio: validated.aspect_ratio }),
  };

  let model: string;
  if (hasReferenceImages) {
    model = EDIT_MODEL;
    input.image_urls = validated.image_urls;
  } else {
    model = T2I_MODEL;
  }

  return { model, input };
}
