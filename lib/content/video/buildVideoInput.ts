import type { z } from "zod";
import type { createVideoBodySchema } from "./validateCreateVideoBody";

type VideoParams = z.infer<typeof createVideoBodySchema>;

/**
 * Maps the validated request body to MiniMax H3 Max's real fal input shape.
 *
 * Every field here is one H3 Max actually accepts (verified against fal's
 * OpenAPI schema for `minimax/h3-max/image-to-video`, recoupable/app#2052) —
 * no `aspect_ratio`, `video_url`, `audio_url`, or `negative_prompt`, none of
 * which exist on this model.
 *
 * @param validated - The validated request body.
 * @returns The fal input object for `minimax/h3-max/image-to-video`.
 */
export function buildVideoInput(validated: VideoParams): Record<string, unknown> {
  return {
    prompt: validated.prompt,
    prompt_expansion_mode: validated.prompt_expansion_mode,
    duration: validated.duration,
    resolution: validated.resolution,
    enable_safety_checker: validated.enable_safety_checker,
    sync_mode: validated.sync_mode,
    ...(validated.seed !== undefined && { seed: validated.seed }),
    ...(validated.image_url && { image_url: validated.image_url }),
    ...(validated.end_image_url && { end_image_url: validated.end_image_url }),
  };
}
