import type { z } from "zod";
import fal from "@/lib/fal/server";
import type { createVideoBodySchema } from "./validateCreateVideoBody";
import { loadTemplate } from "@/lib/content/templates";
import { inferMode } from "./inferMode";
import { buildFalInput } from "./buildFalInput";

// Owner ruling 2026-08-31: MiniMax H3 Max is the house image-to-video model;
// lipsync goes to OmniHuman, which is the only one that syncs a mouth to real
// audio. Ids verified against fal 2026-09-02. Not caller-overridable — cost is
// only predictable if the model is ours (recoupable/app#2052).
const HOUSE_I2V_MODEL = "minimax/h3-max/image-to-video";

const MODELS: Record<string, string> = {
  prompt: HOUSE_I2V_MODEL,
  animate: HOUSE_I2V_MODEL,
  reference: HOUSE_I2V_MODEL,
  extend: HOUSE_I2V_MODEL,
  "first-last": HOUSE_I2V_MODEL,
  lipsync: "fal-ai/bytedance/omnihuman/v1.5",
};

type VideoParams = z.infer<typeof createVideoBodySchema>;

export interface GenerateVideoResult {
  videoUrl: string;
  mode: string;
}

/**
 * Generate a video using the fal API.
 *
 * @param validated - Validated video generation parameters.
 * @returns Object with the video URL and resolved mode.
 * @throws Error if the generation returns no video.
 */
export async function generateVideo(validated: VideoParams): Promise<GenerateVideoResult> {
  const tpl = validated.template ? loadTemplate(validated.template) : null;

  let promptOverride = validated.prompt;
  if (!promptOverride && tpl?.video) {
    const parts: string[] = [];
    if (tpl.video.movements.length) {
      parts.push(tpl.video.movements[Math.floor(Math.random() * tpl.video.movements.length)]);
    }
    if (tpl.video.moods.length) {
      parts.push(tpl.video.moods[Math.floor(Math.random() * tpl.video.moods.length)]);
    }
    if (parts.length) promptOverride = parts.join(". ");
  }

  const mode = validated.mode ?? inferMode(validated);
  const model = MODELS[mode] ?? MODELS.prompt;
  const input = buildFalInput(mode, { ...validated, prompt: promptOverride ?? validated.prompt });

  const result = await fal.subscribe(model, { input });
  const resultData = result.data as Record<string, unknown>;
  const videoUrl = (resultData?.video as Record<string, unknown>)?.url as string | undefined;

  if (!videoUrl) {
    throw new Error("Video generation returned no video");
  }

  return { videoUrl, mode };
}
